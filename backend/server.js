require("dotenv").config();

// Validate required environment variables
const requiredEnvVars = [
  "JWT_SECRET",
  "TENANT_ID",
  "CLIENT_ID",
  "CLIENT_SECRET",
];
const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);

if (missingEnvVars.length > 0) {
  console.error(
    "❌ Missing required environment variables:",
    missingEnvVars.join(", ")
  );
  console.error("Please create a .env file with the following variables:");
  process.exit(1);
}

const express = require("express");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const { check, validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const app = express();
const path = require("path");
const cron = require("node-cron");
const https = require("https");
const fs = require("fs");
const multer = require("multer");
const xlsx = require("xlsx");
const { ConfidentialClientApplication } = require("@azure/msal-node");
app.use(express.json());
app.use(cors());
app.use(bodyParser.json());

// === SSL CERT ===
const sslDir = path.join(__dirname, "ssl");
const keyFile = path.join(sslDir, "server.key");
const certFile = path.join(sslDir, "server.cert");

// Create SSL directory if it doesn't exist
if (!fs.existsSync(sslDir)) {
  fs.mkdirSync(sslDir, { recursive: true });
  console.log("✅ Created ssl directory");
}

// Function to generate SSL certificates
const generateSSLCertificates = () => {
  const { execSync } = require("child_process");

  try {
    console.log("🔐 Generating SSL certificates for development...");

    // Get local IP address for certificate
    const os = require("os");
    const networkInterfaces = os.networkInterfaces();
    let localIP = "localhost";

    // Find the first non-internal IPv4 address
    for (const name of Object.keys(networkInterfaces)) {
      for (const interface of networkInterfaces[name]) {
        if (interface.family === "IPv4" && !interface.internal) {
          localIP = interface.address;
          break;
        }
      }
      if (localIP !== "localhost") break;
    }

    console.log(`📍 Detected IP address: ${localIP}`);

    // Generate self-signed certificate with multiple CNs
    const command = `openssl req -x509 -newkey rsa:4096 -keyout "${keyFile}" -out "${certFile}" -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=${localIP}" -addext "subjectAltName=DNS:localhost,DNS:${localIP},IP:127.0.0.1,IP:${localIP}"`;

    console.log("🔧 Running openssl command...");
    execSync(command, { stdio: "inherit" });

    console.log("✅ SSL certificates generated successfully!");
    return true;
  } catch (error) {
    console.error("❌ Failed to generate SSL certificates:", error.message);
    return false;
  }
};

// Check if certificates exist, generate if they don't
if (!fs.existsSync(keyFile) || !fs.existsSync(certFile)) {
  console.log(
    "SSL key or cert not found. Attempting to generate certificates..."
  );
  const success = generateSSLCertificates();
  if (!success) {
    console.error(
      "Failed to generate SSL certificates. Please generate them manually."
    );
    process.exit(1);
  }
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/news/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    let ext = path.extname(file.originalname);

    // If extension missing or invalid → force JPG
    if (!ext || ext.trim() === "") {
      ext = ".jpg";
    }

    cb(null, uniqueSuffix + ext.toLowerCase());
  },
});

// === MSAL CONFIG ===
const msalConfig = {
  auth: {
    clientId: process.env.CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
    clientSecret: process.env.CLIENT_SECRET,
  },
};
const cca = new ConfidentialClientApplication(msalConfig);

// === TEAMS MEETING HELPER ===
const getTeamsMeetingEndpoint = () => {
  // If you want to use a specific service account, set TEAMS_SERVICE_ACCOUNT_EMAIL in .env
  if (process.env.TEAMS_SERVICE_ACCOUNT_EMAIL) {
    return `https://graph.microsoft.com/v1.0/users/${process.env.TEAMS_SERVICE_ACCOUNT_EMAIL}/events`;
  }
  // Default: use current admin's account
  return `https://graph.microsoft.com/v1.0/me/events`;
};

// === MODELS ===
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(403).json({ message: "Token missing or invalid format" });
  }

  const token = authHeader.slice(7); // Remove "Bearer "

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error("JWT verification failed:", err.message);
      return res.status(403).json({ message: "Invalid or expired token" });
    }

    if (!decoded.employeeId) {
      return res
        .status(403)
        .json({ message: "Invalid token payload: missing employeeId" });
    }

    req.user = decoded;
    next();
  });
};
const upload = multer({ storage: storage });

/////////////////////////////////////////////////////////////////////////////////////////////// Define Employee schema
const employeeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  employeeId: { type: String, required: true, unique: true, trim: true },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    unique: true,
    sparse: true,
    match: /^\S+@\S+\.\S+$/,
  },
  password: { type: String, required: true },
  userRole: {
    type: String,
    required: true,
    enum: ["Admin", "Hr", "User"],
    default: "User",
  }, // Enum for user roles
  createdBy: { type: String, required: true },
  requiresPasswordReset: { type: Boolean, default: true },
  activeToken: { type: String, default: null }, // ✅ add this
});

// Create Employee model
const Employee = mongoose.model("Employee", employeeSchema);

// Ensure the first administrator exists before the server accepts requests.
async function ensureDefaultAdmin() {
  const existingAdmin = await Employee.findOne({ userRole: "Admin" });
  if (existingAdmin) {
    console.log(`Admin account already exists: ${existingAdmin.employeeId}`);
    return;
  }

  const employeeId = (process.env.ADMIN_EMPLOYEE_ID || "admin").trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("No admin account exists. Set ADMIN_PASSWORD in backend/.env to create the initial admin.");
  }

  const existingEmployee = await Employee.findOne({ employeeId });
  if (existingEmployee) {
    throw new Error(`Cannot create default admin: employeeId ${employeeId} is already in use by a non-admin account.`);
  }

  const admin = new Employee({
    name: process.env.ADMIN_NAME || "Administrator",
    employeeId,
    ...(process.env.ADMIN_EMAIL && { email: process.env.ADMIN_EMAIL }),
    password: await bcrypt.hash(password, 10),
    userRole: "Admin",
    createdBy: "system",
    requiresPasswordReset: true,
  });
  await admin.save();
  console.log(`Default admin account created: ${employeeId}`);
}

// Register employee (POST)
app.post("/api/register", async (req, res) => {
  const { name, employeeId, email, password, confirmPassword, userRole, createdBy } =
    req.body;

  if (
    !name ||
    !employeeId ||
    !email ||
    !password ||
    !confirmPassword ||
    !userRole ||
    !createdBy
  ) {
    return res.status(400).json({ error: "All fields are required" });
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match" });
  }

  // Check if employeeId exists
  const existingEmployee = await Employee.findOne({ employeeId });
  if (existingEmployee) {
    return res.status(400).json({ error: "Employee ID already exists" });
  }

  const existingEmail = await Employee.findOne({ email: email.toLowerCase().trim() });
  if (existingEmail) {
    return res.status(400).json({ error: "Email already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newEmployee = new Employee({
    name,
    employeeId,
    email,
    password: hashedPassword,
    userRole,
    createdBy,
    requiresPasswordReset: true,
  });
  await newEmployee.save();

  res.status(201).json({ message: "Employee registered successfully" });
});

// Login route (POST)
app.post("/api/login", async (req, res) => {
  const { employeeId, password } = req.body;

  if (!employeeId || !password) {
    return res
      .status(400)
      .json({ error: "Employee ID and password are required" });
  }

  const employee = await Employee.findOne({ employeeId });
  if (!employee) {
    return res.status(400).json({ error: "Invalid Employee ID or password" });
  }

  const isMatch = await bcrypt.compare(password, employee.password);
  if (!isMatch) {
    return res.status(400).json({ error: "Invalid Employee ID or password" });
  }

  // Check for existing active session
  if (employee.activeToken) {
    try {
      jwt.verify(employee.activeToken, process.env.JWT_SECRET);
      // If token is still valid, deny login
      return res
        .status(409)
        .json({ error: "This account is already logged in elsewhere." });
    } catch (err) {
      // Token is invalid or expired, allow login
    }
  }

  const token = jwt.sign(
    {
      id: employee._id,
      employeeId: employee.employeeId,
      role: employee.userRole,
    },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );

  // Store token in DB
  employee.activeToken = token;
  await employee.save();

  res.json({
    message: "Login successful",
    token,
    role: employee.userRole,
    requiresPasswordReset: employee.requiresPasswordReset,
    employeeId: employee.employeeId,
  });

  console.log(`Login successful by ${employee.name} - ${employee.employeeId}`);
});

//logout  API
app.post("/logout", async (req, res) => {
  const { employeeId } = req.body;
  try {
    const employee = await Employee.findOne({ employeeId });
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    employee.activeToken = null;
    await employee.save();

    res.status(200).json({ message: "Logout successful" });
    console.log(
      `Logout successful by ${employee.name} - ${employee.employeeId}`
    );
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ error: "Logout failed" });
  }
});

//automatically clean up token after 10 min
cron.schedule("*/3 * * * *", async () => {
  const employees = await Employee.find({ activeToken: { $ne: null } });
  for (const emp of employees) {
    try {
      jwt.verify(emp.activeToken, process.env.JWT_SECRET);
      // Token is valid, no action needed
    } catch (err) {
      // Token expired — clear from DB
      emp.activeToken = null;
      await emp.save();
      console.log(`Expired token cleared for: ${emp.employeeId}`);
    }
  }
});

cron.schedule("*/3 * * * *", async () => {
  try {
    // Find all employees who have an active token
    const employees = await Employee.find({ activeToken: { $ne: null } });

    if (employees.length === 0) {
      console.log("No active tokens to clear");
      return;
    }

    // Loop through each employee and clear the activeToken
    for (const employee of employees) {
      employee.activeToken = null;
      await employee.save();
      console.log(`Cleared active token for employee: ${employee.employeeId}`);
    }

    console.log("All active tokens cleared");
  } catch (err) {
    console.error("Error clearing tokens:", err);
  }
});

app.put("/api/employees/:employeeId/update-password", async (req, res) => {
  const { employeeId } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({
      error: "Password must be at least 6 characters long.",
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 🔥 Update password, disable reset requirement, and clear any active token
    const updatedEmployee = await Employee.findOneAndUpdate(
      { employeeId },
      {
        $set: {
          password: hashedPassword,
          requiresPasswordReset: false,
          activeToken: null, // ✅ Clears token immediately on password change
        },
      },
      { new: true }
    );

    if (!updatedEmployee) {
      return res.status(404).json({ error: "Employee not found." });
    }

    console.log(`✅ Password changed and token cleared for ${employeeId}`);

    res.status(200).json({
      message: "Password updated successfully. Please log in again.",
      employee: updatedEmployee,
    });
  } catch (err) {
    console.error("Password update error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Update employee details (PUT)
app.put("/api/employees/:id", async (req, res) => {
  const { name, employeeId, email, userRole } = req.body;

  if (!name || !employeeId || !email || !userRole) {
    return res
      .status(400)
      .json({ error: "Name, Employee ID, Email, and User Role are required." });
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: "Valid email is required." });
  }

  try {
    const existingEmail = await Employee.findOne({
      email: email.toLowerCase().trim(),
      _id: { $ne: req.params.id },
    });
    if (existingEmail) {
      return res.status(400).json({ error: "Email already exists." });
    }

    const updatedEmployee = await Employee.findByIdAndUpdate(
      req.params.id,
      { name, employeeId, email, userRole },
      { new: true, runValidators: true }
    );

    if (!updatedEmployee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    res.status(200).json(updatedEmployee);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update employee details." });
  }
});

// Delete employee (DELETE)
app.delete("/api/employees/:id", async (req, res) => {
  try {
    const deletedEmployee = await Employee.findByIdAndDelete(req.params.id);

    if (!deletedEmployee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    res.status(200).json({ message: "Employee deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete employee." });
  }
});

// Get all employees or search by employeeId/search term (GET)
app.get("/api/employees", async (req, res) => {
  try {
    const { employeeId, search } = req.query;
    const query = {};

    if (employeeId) {
      query.employeeId = employeeId;
    } else if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { employeeId: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const employees = await Employee.find(query);
    res.status(200).json(employees);
  } catch (err) {
    console.error("Failed to fetch employees:", err);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
});

// Change Password - Admin can change any employee's password
app.put(
  "/api/employees/:id/change-password",
  authenticateToken,
  async (req, res) => {
    const { id } = req.params;
    const { newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    try {
      if (req.user.role !== "Admin") {
        return res.status(403).json({ message: "Unauthorized. Admins only." });
      }

      const employee = await Employee.findById(id);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found." });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 6);
      employee.password = hashedPassword;
      employee.requiresPasswordReset = true;
      employee.activeToken = null;
      await employee.save();

      res.status(200).json({ message: "Password updated successfully." });
    } catch (err) {
      res.status(500).json({ message: "Failed to change password." });
    }
  }
);


///////////////////////////////////////////////////////////////////////////////////////////// Booking schema and model
const bookingSchema = new mongoose.Schema({
  empName: { type: String, required: true },
  employeeId: { type: String, required: true },
  email: { type: String, required: true, match: /^\S+@\S+\.\S+$/ }, // Email format validation
  date: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  room: { type: String, required: true },
  cc: { type: [String], default: [] },
  status: {
    type: String,
    default: "pending",
    enum: [
      "pending",
      "approved",
      "declined",
      "closed",
      "ongoing",
      "cancelled",
      "completed",
    ],
  },
  ma: { type: String, required: true },
  subject: { type: String, default: null }, // For Teams meeting subject
  bookedBy: { type: String, required: true },
  approvedBy: { type: String, default: null },
  declinedBy: { type: String, default: null },
  remark: { type: String, required: false },
  submittedAt: {
    type: Date,
    default: Date.now, // Automatically set if not provided
  },
  approvedAt: Date,
  declinedAt: Date,
  editedAt: Date,
  closedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  createdAt: { type: Date, default: Date.now },
  recurrenceType: {
    type: String,
    enum: ["none", "daily", "weekly", "monthly"],
    default: "none",
  },
  recurrenceDayOfWeek: {
    type: String, // e.g., "monday", "friday"
    default: null,
  },
  recurrenceEndDate: {
    type: Date, // until when to repeat
    default: null,
  },
  parentBookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking",
    default: null,
  },
  outlookEventId: { type: String, default: null },

  meetingType: {
    type: String,
    enum: ["In-Person", "Microsoft Teams"],
    default: "In-Person",
  },
  meetingLink: { type: String, default: null }, // For storing Teams meeting links
});

const Booking = mongoose.model("Booking", bookingSchema);
const BOOKING_CONFLICT_STATUSES = ["pending", "approved", "ongoing", "completed"];
// ======================================================
// 📅 Create Booking (with Recurrence + Reception Email)
// ======================================================
app.post(
  "/api/booking",
  [
    check("empName").notEmpty().withMessage("Employee Name is required."),
    check("employeeId").notEmpty().withMessage("Employee Id is required."),
    check("date").isDate().withMessage("Valid date is required."),
    check("startTime").notEmpty().withMessage("Start Time is required."),
    check("endTime").notEmpty().withMessage("End Time is required."),
    check("email").isEmail().withMessage("Valid email is required."),
    check("room").notEmpty().withMessage("Room is required."),
    check("ma").notEmpty().withMessage("Agenda is required."),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    try {
      const {
        empName,
        employeeId,
        date,
        startTime,
        endTime,
        email,
        cc,
        room,
        ma,
        bookedBy,
        remark,
        recurrenceType = "none", // none | daily | weekly | monthly
        recurrenceEndDate, // optional end date
      } = req.body;

      const ccList = cc ? cc.split(",").map((x) => x.trim()) : [];
      const receptionEmail = "helpdesk.it@apotheconpharma.com"; // <-- Add your reception email address here

      // ======================================================
      // 🌀 Recurring Booking Creation
      // ======================================================
      if (recurrenceType !== "none" && recurrenceEndDate) {
        const startDate = new Date(date);
        const endDate = new Date(recurrenceEndDate);
        const createdBookings = [];
        let currentDate = new Date(startDate);
        let parentBookingId = null;

        while (currentDate <= endDate) {
          const currentDateStr = currentDate.toISOString().split("T")[0];

          // Conflict check
          const conflict = await Booking.findOne({
            room,
            date: currentDateStr,
            status: { $in: BOOKING_CONFLICT_STATUSES },
            $or: [{ startTime: { $lt: endTime }, endTime: { $gt: startTime } }],
          });
          if (conflict) {
            return res.status(400).json({
              error: `Room ${room} is already booked on ${currentDateStr} (${startTime}–${endTime})`,
            });
          }

          const newBooking = new Booking({
            empName,
            employeeId,
            date: currentDateStr,
            startTime,
            endTime,
            email,
            cc: ccList,
            room,
            ma,
            bookedBy,
            remark: remark || "",
            meetingType: "In-Person",
            recurrenceType,
            recurrenceEndDate,
            parentBookingId,
            submittedAt: new Date(),
            status: "pending",
          });

          await newBooking.save();

          if (!parentBookingId) {
            parentBookingId = newBooking._id;
            await Booking.findByIdAndUpdate(parentBookingId, {
              parentBookingId,
            });
          }

          createdBookings.push(newBooking);

          // Increment based on recurrence
          if (recurrenceType === "daily")
            currentDate.setDate(currentDate.getDate() + 1);
          else if (recurrenceType === "weekly")
            currentDate.setDate(currentDate.getDate() + 7);
          else if (recurrenceType === "monthly")
            currentDate.setMonth(currentDate.getMonth() + 1);
          else break;
        }

        // ======================================================
        // ✉️ Send Reception Email for the FIRST Booking Only
        // ======================================================
        const firstBooking = createdBookings[0];
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: receptionEmail,
          subject: `📢 New Recurring Booking Request (${recurrenceType}) for ${firstBooking.room} starting ${firstBooking.date}`,
          html: `
          <html>
            <body style="background: #f4f7fa; font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0;">
              <div style="max-width: 520px; margin: 32px auto; background: #fff; border-radius: 18px; box-shadow: 0 8px 32px rgba(102,126,234,0.13); overflow: hidden;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #7f53ac 100%); color: #000000ff; padding: 28px 0 18px 0; text-align: center;">
                  <h2 style="margin: 0; font-size: 1.5rem; font-weight: 700; letter-spacing: 1px;">
                    Recurring Meeting Room Booking Notification
                  </h2>
                </div>
                <div style="padding: 28px 24px 18px 24px;">
                  <p style="font-size: 1.08rem; color: #000000ff; margin-bottom: 18px;"><strong>Dear Reception,</strong></p>
                  <p style="font-size: 1.05rem; color: #000000ff; margin-bottom: 18px;">A new recurring meeting room booking has been requested. Details of the first occurrence are below:</p>
                  <table style="width: 100%; border-collapse: collapse; font-size: 1.01rem; margin-bottom: 18px;">
                    <tr><td style="padding: 10px 8px; font-weight: bold; color: #667eea;">Employee Name</td><td style="padding: 10px 8px;">${firstBooking.empName}</td></tr>
                    <tr><td style="padding: 10px 8px; font-weight: bold; color: #667eea;">Employee ID</td><td style="padding: 10px 8px;">${firstBooking.employeeId}</td></tr>
                    <tr><td style="padding: 10px 8px; font-weight: bold; color: #667eea;">Start Date</td><td style="padding: 10px 8px;">${firstBooking.date}</td></tr>
                    <tr><td style="padding: 10px 8px; font-weight: bold; color: #667eea;">End Recurrence</td><td style="padding: 10px 8px;">${recurrenceEndDate}</td></tr>
                    <tr><td style="padding: 10px 8px; font-weight: bold; color: #667eea;">Time</td><td style="padding: 10px 8px;">${firstBooking.startTime} – ${firstBooking.endTime}</td></tr>
                    <tr><td style="padding: 10px 8px; font-weight: bold; color: #667eea;">Room</td><td style="padding: 10px 8px;">${firstBooking.room}</td></tr>
                    <tr><td style="padding: 10px 8px; font-weight: bold; color: #667eea;">Agenda</td><td style="padding: 10px 8px;">${firstBooking.ma}</td></tr>
                  </table>
                </div>
                <div style="background: #f8fafd; color: #888; font-size: 0.98rem; padding: 18px 24px; border-top: 1px solid #e0e7ff;">
                  <p style="margin: 0;">Best regards,<br>HR || ADMIN<br>Ext No. :- 9/447</p>
                </div>
              </div>
            </body>
          </html>`,
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error(`Error sending reception email:`, error);
          } else {
            console.log(`Reception notification sent:`, info.response);
          }
        });

        return res.status(201).json({
          message: `Recurring booking (${recurrenceType}) created successfully`,
          bookings: createdBookings,
        });
      }

      // ======================================================
      // 🗓️ Single Booking (Default)
      // ======================================================
      const conflictingBookings = await Booking.find({
        room,
        date,
        status: { $in: BOOKING_CONFLICT_STATUSES },
        $or: [{ startTime: { $lt: endTime }, endTime: { $gt: startTime } }],
      });

      if (conflictingBookings.length > 0) {
        return res
          .status(400)
          .json({ error: "The selected time slot is already booked." });
      }

      const newBooking = new Booking({
        empName,
        employeeId,
        date,
        startTime,
        endTime,
        email,
        cc: ccList,
        room,
        ma,
        bookedBy,
        meetingType: "In-Person",
        submittedAt: new Date(),
        remark: remark || "",
      });

      await newBooking.save();

      // ======================================================
      // ✉️ Send Reception Email (Original)
      // ======================================================
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: receptionEmail,
        subject: `📢 New Booking Request for ${newBooking.room} on ${newBooking.date}`,
        html: `<html>
    <body style="background: #f4f7fa; font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0;">
      <div style="max-width: 520px; margin: 32px auto; background: #fff; border-radius: 18px; box-shadow: 0 8px 32px rgba(102,126,234,0.13); overflow: hidden;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #7f53ac 100%); color: #000000ff; padding: 28px 0 18px 0; text-align: center;">
          
          <h2 style="margin: 0; font-size: 1.5rem; font-weight: 700; letter-spacing: 1px;">Meeting Room Booking Notification</h2>
        </div>
        <div style="padding: 28px 24px 18px 24px;">
          <p style="font-size: 1.08rem; color: #000000ff; margin-bottom: 18px;"><strong>Dear Reception,</strong></p>
          <p style="font-size: 1.05rem; color: #000000ff; margin-bottom: 18px;">A new meeting room booking has been requested. Please find the details below:</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 1.01rem; margin-bottom: 18px;">
            <tr><td style="padding: 10px 8px; font-weight: bold; color: #667eea;">Employee Name</td><td style="padding: 10px 8px;">${newBooking.empName}</td></tr>
            <tr><td style="padding: 10px 8px; font-weight: bold; color: #667eea;">Employee ID</td><td style="padding: 10px 8px;">${newBooking.employeeId}</td></tr>
            <tr><td style="padding: 10px 8px; font-weight: bold; color: #667eea;">Date</td><td style="padding: 10px 8px;">${newBooking.date}</td></tr>
            <tr><td style="padding: 10px 8px; font-weight: bold; color: #667eea;">Time</td><td style="padding: 10px 8px;">${newBooking.startTime} – ${newBooking.endTime}</td></tr>
            <tr><td style="padding: 10px 8px; font-weight: bold; color: #667eea;">Room</td><td style="padding: 10px 8px;">${newBooking.room}</td></tr>
            <tr><td style="padding: 10px 8px; font-weight: bold; color: #667eea;">Agenda</td><td style="padding: 10px 8px;">${newBooking.ma}</td></tr>
          </table>
        </div>
        <div style="background: #f8fafd; color: #888; font-size: 0.98rem; padding: 18px 24px; border-top: 1px solid #e0e7ff;">
          <p style="margin: 0;">Best regards,<br>HR || ADMIN<br>Ext No. :- 9/447</p>
        </div>
      </div>
    </body>
  </html>
`,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error(`Error sending reception email:`, error);
        } else {
          console.log(`Reception notification sent:`, info.response);
        }
      });

      res.status(201).json({
        message: "Booking request submitted successfully",
        status: "pending",
      });
    } catch (err) {
      console.error("Booking Error:", err);
      res.status(500).json({ error: "Failed to submit booking request" });
    }
  }
);

// ================================
// ✅ UPDATED APPROVAL ROUTE (Service Account Based)
// ================================
app.put("/api/booking/:id", authenticateToken, async (req, res) => {
  try {
    const {
      status,
      remark,
      approvedBy: clientApprovedBy,
      declinedBy: clientDeclinedBy,
    } = req.body;

    const approvedBy = req.user?.employeeId || clientApprovedBy;
    const declinedBy = req.user?.employeeId || clientDeclinedBy;

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    // ────────────────────────────────────────────────
    // 🧩 APPROVAL LOGIC
    // ────────────────────────────────────────────────
    if (status === "approved") {
      // 1️⃣ Check time conflicts
      const conflicts = await Booking.find({
        _id: { $ne: booking._id },
        room: booking.room,
        date: booking.date,
        status: { $in: BOOKING_CONFLICT_STATUSES },
        $or: [
          { startTime: { $lt: booking.endTime }, endTime: { $gt: booking.startTime } },
        ],
      });

      if (conflicts.length > 0)
        return res.status(400).json({ message: "Conflicting bookings detected" });

      booking.approvedBy = approvedBy;
      booking.approvedAt = new Date();
      booking.status = "approved";

      // 2️⃣ Prepare times
      const startDateTime = new Date(`${booking.date}T${booking.startTime}:00`);
      const endDateTime = new Date(`${booking.date}T${booking.endTime}:00`);
      const start = startDateTime.toISOString().split(".")[0] + "Z";
      const end = endDateTime.toISOString().split(".")[0] + "Z";

      // 3️⃣ Build attendees (Requester + CCs)
      const attendees = [
        {
          emailAddress: { address: booking.email, name: booking.empName },
          type: "required",
        },
        ...(booking.cc || []).map((email) => ({
          emailAddress: { address: email, name: email.split("@")[0] },
          type: "optional",
        })),
      ];

      // 4️⃣ Prepare event payload
      const payload = {
        subject: booking.subject || booking.ma || `Meeting - ${booking.room}`,
        start: { dateTime: start, timeZone: "UTC" },
        end: { dateTime: end, timeZone: "UTC" },
        attendees,
      };

      payload.body = {
        contentType: "HTML",
        content: booking.ma || `Meeting in ${booking.room}`,
      };
      payload.location = { displayName: booking.room };

      // ────────────────────────────────────────────────
      // 🧠 Create meeting using Service Account
      // ────────────────────────────────────────────────
      try {
        const result = await cca.acquireTokenByClientCredential({
          scopes: ["https://graph.microsoft.com/.default"],
        });
        const serviceToken = result.accessToken;
        const calendarUser = process.env.TEAMS_SERVICE_ACCOUNT_EMAIL;

        const msResponse = await axios.post(
          `https://graph.microsoft.com/v1.0/users/${calendarUser}/events`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${serviceToken}`,
              "Content-Type": "application/json",
            },
            timeout: 11010,
          }
        );

        booking.outlookEventId = msResponse.data.id;
        booking.meetingLink = null;
        logIST(`✅ Outlook event created (ID: ${booking.outlookEventId})`);
      } catch (graphErr) {
        console.error("❌ Graph API error:", graphErr.response?.data || graphErr);
        logIST(`❌ Microsoft Graph API error: ${graphErr.message}`);
      }

      // ────────────────────────────────────────────────
      // 📧 Send notification email
      // ────────────────────────────────────────────────
      sendApprovalEmail(booking.email, booking);
      logIST(`✅ Booking ${booking._id} approved by ${approvedBy}`);
    }

    // ────────────────────────────────────────────────
    // ❌ DECLINE LOGIC
    // ────────────────────────────────────────────────
    if (status === "declined") {
      booking.status = "declined";
      booking.declinedBy = declinedBy;
      booking.declinedAt = new Date();
      sendDeclineEmail(booking.email, booking);
      logIST(`❌ Booking ${booking._id} declined by ${declinedBy}`);
    }

    // ────────────────────────────────────────────────
    // OTHER STATUS HANDLERS
    // ────────────────────────────────────────────────
    if (status === "closed") {
      booking.status = "closed";
      booking.closedAt = new Date();
    }
    if (status === "completed") {
      booking.status = "completed";
      booking.completedAt = new Date();
    }
    if (status === "cancelled") {
      booking.status = "cancelled";
      booking.cancelledAt = new Date();
    }

    if (remark !== undefined) booking.remark = remark;

    await booking.save();
    res.status(200).json({
      message: "Booking updated successfully",
      booking,
      teamsLinkCreated: false,
    });
  } catch (err) {
    logIST(`💥 Error updating booking ${req.params.id}: ${err.message}`);
    console.error(err);
    res.status(500).json({
      message: "Failed to update booking",
      error: err.message,
    });
  }
});


// ================================
// PUT /api/booking/update/:id - Edit Booking (with Outlook event update + conflict check)
// ================================
app.put("/api/booking/update/:id", authenticateToken, async (req, res) => {
  const {
    date,
    startTime,
    endTime,
    room,
    status,
    remark,
  } = req.body;

  if (!date || !startTime || !endTime || !room) {
    logIST(`❌ Missing required fields for editing booking ${req.params.id}`);
    return res.status(400).json({
      error: "Date, Start Time, End Time, and Room are required.",
    });
  }

  try {
    // ───────────────────────────────
    // 🔍 Check for conflicting bookings
    // ───────────────────────────────
    const conflicts = await Booking.find({
      room,
      date,
      status: { $in: BOOKING_CONFLICT_STATUSES },
      _id: { $ne: req.params.id },
      $or: [{ startTime: { $lt: endTime }, endTime: { $gt: startTime } }],
    });

    if (conflicts.length > 0) {
      logIST(`❌ Edit conflict detected for booking ${req.params.id}`);
      return res.status(400).json({
        error: "The selected time slot for this room is already booked.",
      });
    }

    // ───────────────────────────────
    // ✏️ Update booking data
    // ───────────────────────────────
    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id,
      {
        date,
        startTime,
        endTime,
        room,
        remark,
        status: status || "approved",
        editedAt: new Date(),
      },
      { new: true }
    );

    if (!updatedBooking) {
      logIST(`⚠️ Booking not found (ID: ${req.params.id})`);
      return res.status(404).json({ message: "Booking not found." });
    }

    // ───────────────────────────────
    // 🧩 Create or Update Outlook Event
    // ───────────────────────────────
    if (status === "approved" || updatedBooking.status === "approved") {
      logIST(`🔹 Syncing Outlook event for edited booking ${req.params.id}`);

      const startDateTime = new Date(`${date}T${startTime}:00`);
      const endDateTime = new Date(`${date}T${endTime}:00`);
      const start = startDateTime.toISOString().split(".")[0] + "Z";
      const end = endDateTime.toISOString().split(".")[0] + "Z";

      // Build attendees list
      const attendees = [];
      if (updatedBooking.email) {
        attendees.push({
          emailAddress: {
            address: updatedBooking.email,
            name: updatedBooking.empName || updatedBooking.email.split("@")[0],
          },
          type: "required",
        });
      }
      if (updatedBooking.cc && Array.isArray(updatedBooking.cc)) {
        updatedBooking.cc.forEach((email) => {
          if (email) {
            attendees.push({
              emailAddress: { address: email, name: email.split("@")[0] },
              type: "optional",
            });
          }
        });
      }

      // Prepare payload for Outlook
      const payload = {
        subject:
          updatedBooking.subject ||
          updatedBooking.ma ||
          `Meeting - ${updatedBooking.room}`,
        start: { dateTime: start, timeZone: "UTC" },
        end: { dateTime: end, timeZone: "UTC" },
        attendees,
      };

      payload.body = {
        contentType: "HTML",
        content: updatedBooking.ma || `Meeting in ${room}`,
      };
      payload.location = { displayName: room };

      // ───────────────────────────────
      // 🔐 Use Service Account Token
      // ───────────────────────────────
      try {
        const result = await cca.acquireTokenByClientCredential({
          scopes: ["https://graph.microsoft.com/.default"],
        });
        const serviceToken = result.accessToken;
        const calendarUser = process.env.TEAMS_SERVICE_ACCOUNT_EMAIL;

        let msResponse;
        if (updatedBooking.outlookEventId) {
          // 🔄 Update existing Outlook event
          logIST(`🔄 Updating existing Outlook event (${updatedBooking.outlookEventId})`);
          msResponse = await axios.patch(
            `https://graph.microsoft.com/v1.0/users/${calendarUser}/events/${updatedBooking.outlookEventId}`,
            payload,
            {
              headers: {
                Authorization: `Bearer ${serviceToken}`,
                "Content-Type": "application/json",
              },
              timeout: 11010,
            }
          );
        } else {
          // 🆕 Create new Outlook event
          logIST(`🆕 Creating new Outlook event for booking ${req.params.id}`);
          msResponse = await axios.post(
            `https://graph.microsoft.com/v1.0/users/${calendarUser}/events`,
            payload,
            {
              headers: {
                Authorization: `Bearer ${serviceToken}`,
                "Content-Type": "application/json",
              },
              timeout: 11010,
            }
          );

          updatedBooking.outlookEventId = msResponse.data.id;
        }

        updatedBooking.meetingLink = null;
        logIST(`✅ Outlook event synced (ID: ${updatedBooking.outlookEventId})`);

        await updatedBooking.save();
      } catch (graphErr) {
        logIST(`❌ Microsoft Graph API error: ${graphErr.message}`);
        console.error(graphErr.response?.data || graphErr);
      }
    }

    // ───────────────────────────────
    // 📧 Optional email notification
    // ───────────────────────────────
    sendUpdatedBookingEmail(updatedBooking);

    logIST(
      `✏️ Booking ${req.params.id} edited → Room: ${room}, Date: ${date}, Time: ${startTime}-${endTime}`
    );
    if (remark) logIST(`→ Remark: "${remark}"`);
    if (updatedBooking.meetingLink)
      logIST(`→ Teams Link: ${updatedBooking.meetingLink}`);

    res.status(200).json(updatedBooking);
  } catch (err) {
    logIST(`💥 Error editing booking ${req.params.id}: ${err.message}`);
    console.error(err);
    res.status(500).json({ error: "Failed to update booking details." });
  }
});

// Get the logged-in employee's bookings (GET)
app.get("/api/booking/my-booking", authenticateToken, async (req, res) => {
  try {
    const bookings = await Booking.find({ employeeId: req.user.employeeId });

    // Always return 200 with a consistent format
    return res.status(200).json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch your bookings." });
  }
});
// this is for auto update the status ongoing , closed , and completed

// Get employee details by employeeId (for BookingForm auto-fill)
app.get("/api/employees/:id", async (req, res) => {
  try {
    const employee = await Employee.findOne({ employeeId: req.params.id });
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    res.json({ name: employee.name, email: employee.email || "" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

cron.schedule("* * * * *", async () => {
  console.log("Server is Running Continue...");

  try {
    const currentTime = new Date();

    // Find all bookings where the status is 'approved' or 'pending'
    const bookings = await Booking.find({
      status: { $in: ["approved", "pending", "ongoing"] },
    });

    bookings.forEach(async (booking) => {
      const bookingStartTime = new Date(`${booking.date}T${booking.startTime}`);
      const bookingEndTime = new Date(`${booking.date}T${booking.endTime}`);

      // If current time is between the start and end time, set status to 'ongoing'
      if (
        currentTime >= bookingStartTime &&
        currentTime <= bookingEndTime &&
        booking.status === "approved"
      ) {
        booking.status = "ongoing";
        await booking.save();
        console.log(`Booking ${booking._id} status updated to 'ongoing' `);
      }

      // If the booking time has passed, set status to 'completed'
      if (currentTime >= bookingEndTime && booking.status === "ongoing") {
        booking.status = "completed";
        await booking.save();
        console.log(`Booking ${booking._id} status updated to 'completed'`);
      }

      // If the booking is still pending and the current time has passed the start time, set it to 'closed'
      if (booking.status === "pending" && currentTime >= bookingStartTime) {
        booking.status = "closed";
        await booking.save();
        console.log(`Booking ${booking._id} status updated to 'closed'`);
      }
    });
  } catch (err) {
    console.error("Error during status update task:", err);
  }
});

//////////////////////////////////////// Nodemailer transporter for sending emails
let transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false, // STARTTLS
  auth: {
    user: process.env.EMAIL_USER, // Replace with your Outlook email
    pass: process.env.EMAIL_PASS, // App password if 2FA is enabled
    user1: process.env.EMAIL_USER1, // Replace with your email
    pass1: process.env.EMAIL_PASS1, // Use an App Password if you have 2FA
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// Function to send approval email
const sendApprovalEmail = (email, bookingDetails) => {
  const cc =
    bookingDetails.cc && Array.isArray(bookingDetails.cc)
      ? bookingDetails.cc.join(", ")
      : "";

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    cc: cc,
    subject: "📅 Meeting Room Booking Confirmed",
    html: `
    <html>
      <body style="background: #f5f7fb; font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0;">
        <div style="margin: 40px auto; background: #fff; border-radius: 18px; box-shadow: 0 6px 28px rgba(0,0,0,0.08); overflow: hidden; border: 1px solid #e4e9f2;">
          
          <!-- Header -->
          <!-- Body -->
          <div style="padding: 32px 34px 20px 34px;">
            <p style="font-size: 1.1rem; color: #2f3b52; margin-bottom: 16px; line-height: 1.6;">
              <strong>Dear ${bookingDetails.empName},</strong>
            </p>

            <p style="font-size: 1.05rem; color: #3b4354; margin-bottom: 26px; line-height: 1.65;">
              We’re pleased to inform you that your meeting room has been 
              <span style="color: #2a7dfc; font-weight: 600;">Confirmed</span>.  
              Below are your booking details:
            </p>

            <!-- Booking Details Table -->
<div style="margin: 22px 0 30px;">
  <table style="width: 100%; border-collapse: collapse; font-size: 1rem; border-radius: 12px; border: 1px solid #dee3f0;">
    <thead>
      <tr style="background: #f0f4fb; color: #2a7dfc; font-weight: 600;">
        <th style="padding: 12px 10px; border-bottom: 1px solid #dee3f0; text-align:left; white-space: nowrap;">Room</th>
        <th style="padding: 12px 10px; border-bottom: 1px solid #dee3f0; text-align:left; white-space: nowrap;">Date</th>
        <th style="padding: 12px 10px; border-bottom: 1px solid #dee3f0; text-align:left; white-space: nowrap;">Time</th>
        <th style="padding: 12px 10px; border-bottom: 1px solid #dee3f0; text-align:left; white-space: nowrap;">Meeting Agenda</th>
      </tr>
    </thead>

    <tbody>
      <tr style="background: #fcfdff; color: #333;">
        <td style="padding: 12px 10px; border-bottom: 1px solid #f0f2f8; white-space: nowrap;">${
          bookingDetails.room
        }</td>

        <!-- DATE: dd-mm-yyyy (non-breaking hyphens) -->
        <td style="padding: 12px 10px; border-bottom: 1px solid #f0f2f8; white-space: nowrap;">
          ${bookingDetails.date.split("-").reverse().join("&#8209;")}
        </td>

        <!-- TIME: non-breaking spaces & en-dash -->
        <td style="padding: 12px 10px; border-bottom: 1px solid #f0f2f8; white-space: nowrap;">
          ${bookingDetails.startTime}&nbsp;&#8211;&nbsp;${
      bookingDetails.endTime
    }
        </td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #f0f2f8; white-space: nowrap;">${
          bookingDetails.ma || "N/A"
        }</td>
      </tr>
    </tbody>
  </table>
</div>
            <!-- Meeting Link Button -->
            ${
              false
                ? `<div style="margin: 28px 0 16px; text-align: center;">
                    <a href="${bookingDetails.meetingLink}" target="_blank"
                      style="display: inline-block; background: linear-gradient(135deg, #0078d4 0%, #2a7dfc 100%);
                      color: #131313ff; font-weight: 600; padding: 14px 36px; border-radius: 8px;
                      text-decoration: none; font-size: 1.05rem; box-shadow: 0 3px 10px rgba(42,125,252,0.25); transition: background 0.3s;">
                      🎥 Click here to Join Teams Meeting
                    </a>
                  </div>`
                : ""
            }

            <p style="font-size: 1.02rem; color: #555; line-height: 1.65; margin-top: 30px;">
              If you need to make any changes or request additional setup support,  
              please reach out to <strong>HRA</strong>.  
              We’ll be happy to assist you.
            </p>
          </div>

          <!-- Footer -->
          <div style="background: #f6f8fc; color: #7a8599; font-size: 0.95rem; padding: 22px 30px; border-top: 1px solid #e3e8f2;">
            <p style="margin: 0;">Warm regards,<br><strong>HR | ADMIN</strong><br>Ext No.: 9/447</p>
          </div>
        </div>
      </body>
    </html>
    `,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log("Error sending email:", error);
    } else {
      console.log("Email sent: " + info.response);
    }
  });
};

// Function to send decline email
const sendDeclineEmail = (email, bookingDetails) => {
  const cc =
    bookingDetails.cc && Array.isArray(bookingDetails.cc)
      ? bookingDetails.cc.join(", ")
      : "";
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    cc: cc,
    subject: "❌Declined :- Your Meeting Room Request.",
    html: `
    <html>
      <body style="background: #f4f7fa; font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0;">
        <div style="margin: 32px auto; background: #fff; border-radius: 18px; box-shadow: 0 8px 32px rgba(102,126,234,0.13); overflow: hidden;">
        
          <div style="padding: 28px 24px 18px 24px;">
            <p style="font-size: 1.08rem; color: #333; margin-bottom: 18px;"><strong>Dear ${
              bookingDetails.empName
            },</strong></p>
            <p style="font-size: 1.05rem; color: #444; margin-bottom: 18px;">Thank you for your recent request to book a meeting room. <span style="color: #e74c3c; font-weight: 700;">Unfortunately, we are unable to accommodate your request</span> for the following details:</p>
            
<!-- Booking Details Table -->
<div style="margin: 22px 0 30px;">
  <table style="width: 100%; border-collapse: collapse; font-size: 1rem; border-radius: 12px; border: 1px solid #dee3f0;">
    <thead>
      <tr style="background: #f0f4fb; color: #2a7dfc; font-weight: 600;">
        <th style="padding: 12px 10px; border-bottom: 1px solid #dee3f0; text-align:left; white-space: nowrap;">Room</th>
        <th style="padding: 12px 10px; border-bottom: 1px solid #dee3f0; text-align:left; white-space: nowrap;">Date</th>
        <th style="padding: 12px 10px; border-bottom: 1px solid #dee3f0; text-align:left; white-space: nowrap;">Time</th>
        <th style="padding: 12px 10px; border-bottom: 1px solid #dee3f0; text-align:left; white-space: nowrap;">Meeting Agenda</th>
      </tr>
    </thead>

    <tbody>
      <tr style="background: #fcfdff; color: #333;">
        <td style="padding: 12px 10px; border-bottom: 1px solid #f0f2f8; white-space: nowrap;">${
          bookingDetails.room
        }</td>

        <!-- DATE: dd-mm-yyyy (non-breaking hyphens) -->
        <td style="padding: 12px 10px; border-bottom: 1px solid #f0f2f8; white-space: nowrap;">
          ${bookingDetails.date.split("-").reverse().join("&#8209;")}
        </td>

        <!-- TIME: non-breaking spaces & en-dash -->
        <td style="padding: 12px 10px; border-bottom: 1px solid #f0f2f8; white-space: nowrap;">
          ${bookingDetails.startTime}&nbsp;&#8211;&nbsp;${
      bookingDetails.endTime
    }
        </td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #f0f2f8; white-space: nowrap;">${
          bookingDetails.ma || "N/A"
        }</td>
      </tr>
    </tbody>
  </table>
</div>


            
            <p style="font-size: 1.01rem; color: #555;">If you have any questions or would like to explore alternative arrangements, please feel free to reach out to us. We'd be happy to assist in finding another suitable time or room for your meeting.</p>
          </div>
          <div style="background: #f8fafd; color: #888; font-size: 0.98rem; padding: 18px 24px; border-top: 1px solid #e0e7ff;">
            <p style="margin: 0;">Best regards,<br>HR || ADMIN<br>Ext No. :- 9/447</p>
          </div>
        </div>
      </body>
    </html>
  `,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log("Error sending email:", error);
    } else {
      console.log("Email sent: " + info.response);
    }
  });
};

// Function to send updated booking email
const sendUpdatedBookingEmail = (updatedBooking) => {
  const cc =
    updatedBooking.cc && Array.isArray(updatedBooking.cc)
      ? updatedBooking.cc.join(", ")
      : "";

  const hasTeamsLink =
    updatedBooking.meetingLink && updatedBooking.meetingLink.startsWith("http");

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: updatedBooking.email,
    cc: cc,
    subject: "✏️Meeting Details Updated",
    html: `
    <html>
      <body style="background: #f4f7fa; font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0;">
        <div style="margin: 32px auto; background: #fff; border-radius: 20px; box-shadow: 0 8px 32px rgba(67,233,123,0.13); overflow: hidden;">
          <div style="padding: 32px 28px 20px 28px;">
            <p style="font-size: 1.13rem; color: #333; margin-bottom: 18px;"><strong>Dear ${
              updatedBooking.empName
            },</strong></p>
            <p style="font-size: 1.08rem; color: #0c0c0cff; margin-bottom: 18px;">Your meeting room booking has been <span style="color: #f5cc14ff; font-weight: 700;">updated</span>. Here are your revised details:</p>
            <div style="margin: 22px 0 30px;">
             <table style="width: 100%; border-collapse: separate; border-spacing: 0; font-size: 1rem; border-radius: 12px; overflow: hidden; border: 1px solid #dee3f0;">
              <thead >
                <tr style="background: #f0f4fb; color: #2a7dfc; font-weight: 600;">
                    <th style="padding: 14px 10px; border-bottom: 1px solid #dee3f0;">Room</th>
                    <th style="padding: 14px 10px; border-bottom: 1px solid #dee3f0;">Date</th>
                    <th style="padding: 14px 10px; border-bottom: 1px solid #dee3f0;">Time</th>
                    <th style="padding: 14px 10px; border-bottom: 1px solid #dee3f0;">Meeting Agenda</th>
                    <th style="padding: 14px 10px; border-bottom: 1px solid #dee3f0;">Remark</th>
                </tr>
              </thead>
              <tbody> 
                <tr style="background: #fcfdff; color: #333;">
                    <td style="padding: 14px 12px; border-bottom: 1px solid #f0f2f8;">${
                      updatedBooking.room
                    }</td>
                    <td style="padding: 14px 12px; border-bottom: 1px solid #f0f2f8;">${
                      updatedBooking.date
                    }</td>
                    <td style="padding: 14px 12px; border-bottom: 1px solid #f0f2f8;">${
                      updatedBooking.startTime
                    } – ${updatedBooking.endTime}</td>
                    <td style="padding: 14px 12px; border-bottom: 1px solid #f0f2f8;">${
                      updatedBooking.ma || "N/A"
                    }</td>
                    <td style="padding: 14px 12px; border-bottom: 1px solid #f0f2f8;">${
                      updatedBooking.remark || "N/A"
                    }</td>
                  </tr>
                </tbody>
              </table>
            </div>
            ${
              hasTeamsLink
                ? `<div style='text-align:center; margin: 24px 0 0 0;'><a href='${updatedBooking.meetingLink}' style='display:inline-block; background:linear-gradient(90deg,#4399e9ff 0%,#38f9d7 100%); color:rgba(0, 0, 0, 0.86); font-weight:700; padding:14px 32px; border-radius:8px; font-size:1.08rem; text-decoration:none; box-shadow:0 2px 8px rgba(67,233,123,0.13);'>Click here to Join Teams Meeting</a></div>`
                : ""
            }
            <p style="font-size: 1.03rem; color: #555; margin-top: 24px;">If you have any questions, please contact us.</p>
          </div>
          <div style="background: #f8fafd; color: #000000ff; font-size: 1rem; padding: 20px 28px; border-top: 1px solid #e0e7ff;">
            <p style="margin: 0;">Best regards,<br>HR &amp; Admin Team<br>Ext No. :- 9/447</p>
          </div>
        </div>
      </body>
    </html>
    `,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log("Error sending update email:", error);
    } else {
      console.log("Update email sent: " + info.response);
    }
  });
};

// Update booking status (approve/decline/close/ongoing/cancelled) (PUT)
function getISTTime() {
  return new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true, // optional: formats as 11:30 AM/PM
  });
}

function logIST(message) {
  console.log(`[${getISTTime()}] ${message}`);
}

// ================================
// PUT /api/booking/update/:id - Edit Booking
// ================================
app.put("/api/booking/update/:id", authenticateToken, async (req, res) => {
  const {
    date,
    startTime,
    endTime,
    room,
    status,
    remark,
    msGraphToken,
  } = req.body;

  if (!date || !startTime || !endTime || !room) {
    logIST(`❌ Missing required fields for editing booking ${req.params.id}`);
    return res.status(400).json({
      error: "Date, Start Time, End Time, and Room are required.",
    });
  }

  try {
    const conflicts = await Booking.find({
      room,
      date,
      status: { $in: BOOKING_CONFLICT_STATUSES },
      _id: { $ne: req.params.id },
      $or: [{ startTime: { $lt: endTime }, endTime: { $gt: startTime } }],
    });
    if (conflicts.length > 0) {
      logIST(`❌ Edit conflict for booking ${req.params.id}`);
      return res.status(400).json({
        error: "The selected time slot for this room is already booked.",
      });
    }

    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id,
      {
        date,
        startTime,
        endTime,
        room,
        remark,
        status: status || "approved",
        editedAt: new Date(),
      },
      { new: true }
    );

    if (!updatedBooking) {
      logIST(`⚠️ Booking not found for editing (ID: ${req.params.id})`);
      return res.status(404).json({ message: "Booking not found." });
    }

    // === CREATE/UPDATE OUTLOOK EVENT ===
    if (
      (status === "approved" || updatedBooking.status === "approved") &&
      msGraphToken
    ) {
      logIST(
        `🔹 Creating/updating Outlook event for edited booking ${req.params.id}`
      );

      const startDateTime = new Date(`${date}T${startTime}:00`);
      const endDateTime = new Date(`${date}T${endTime}:00`);
      const start = startDateTime.toISOString().split(".")[0] + "Z";
      const end = endDateTime.toISOString().split(".")[0] + "Z";

      const attendees = [];
      if (updatedBooking.email)
        attendees.push({
          emailAddress: {
            address: updatedBooking.email,
            name: updatedBooking.empName || updatedBooking.email.split("@")[0],
          },
          type: "required",
        });
      if (updatedBooking.cc && Array.isArray(updatedBooking.cc))
        updatedBooking.cc.forEach((email) => {
          if (email)
            attendees.push({
              emailAddress: { address: email, name: email.split("@")[0] },
              type: "optional",
            });
        });

      let payload = {
        subject:
          updatedBooking.subject ||
          updatedBooking.ma ||
          `Booking ${updatedBooking._id}`,
        start: { dateTime: start, timeZone: "UTC" },
        end: { dateTime: end, timeZone: "UTC" },
        attendees: attendees.length ? attendees : undefined,
      };

      payload.body = {
        contentType: "HTML",
        content: updatedBooking.ma || `Meeting in ${room}`,
      };
      payload.location = { displayName: room };

      try {
        const msResponse = await axios.post(
          "https://graph.microsoft.com/v1.0/me/events",
          payload,
          {
            headers: {
              Authorization: `Bearer ${msGraphToken}`,
              "Content-Type": "application/json",
            },
            timeout: 11010,
          }
        );

        updatedBooking.outlookEventId = msResponse.data.id;
        updatedBooking.meetingLink = null;
        logIST(
          `✅ Outlook event created for edited booking (ID: ${updatedBooking.outlookEventId})`
        );

        await updatedBooking.save();
      } catch (graphErr) {
        logIST(
          `❌ Microsoft Graph API error for edited booking: ${graphErr.message}`
        );
        console.error(graphErr.response?.data || graphErr);
      }
    }

    sendUpdatedBookingEmail(updatedBooking);

    logIST(
      `✏️ Booking ${req.params.id} edited → Room: ${room}, Date: ${date}, Time: ${startTime}-${endTime}`
    );
    if (remark) logIST(`→ Remark: "${remark}"`);
    if (updatedBooking.meetingLink)
      logIST(`→ Teams Link: ${updatedBooking.meetingLink}`);

    res.status(200).json(updatedBooking);
  } catch (err) {
    logIST(`💥 Error editing booking ${req.params.id}: ${err.message}`);
    console.error(err);
    res.status(500).json({ error: "Failed to update booking details." });
  }
});

// Test endpoint for debugging
app.get("/api/debug/booking/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Debug request for booking ID: ${id}`);

    const booking = await BookingTeams.findById(id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.json({
      booking,
      isValid: {
        hasSubject: !!booking.subject,
        hasDate: !!booking.date,
        hasStartTime: !!booking.startTime,
        hasEndTime: !!booking.endTime,
        hasMeetingType: !!booking.meetingType,
        isPending: booking.status === "Pending",
      },
    });
  } catch (err) {
    console.error("Debug error:", err);
    res.status(500).json({ message: "Debug failed", error: err.message });
  }
});

// Diagnostic endpoint for Microsoft Graph token
app.post("/api/debug/token", async (req, res) => {
  try {
    const { msGraphToken } = req.body;

    if (!msGraphToken) {
      return res.status(400).json({ message: "Token required" });
    }

    console.log(`🔍 Testing Microsoft Graph token...`);

    // Test basic user info
    const userResponse = await axios.get(
      `https://graph.microsoft.com/v1.0/me`,
      {
        headers: {
          Authorization: `Bearer ${msGraphToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Test calendar permissions
    const calendarResponse = await axios.get(
      `https://graph.microsoft.com/v1.0/me/calendar`,
      {
        headers: {
          Authorization: `Bearer ${msGraphToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({
      tokenValid: true,
      user: userResponse.data,
      calendar: calendarResponse.data,
      permissions: {
        userRead: true,
        calendarAccess: true,
      },
    });
  } catch (error) {
    console.error(
      "Token diagnostic error:",
      error.response?.data || error.message
    );
    res.status(400).json({
      tokenValid: false,
      error: error.response?.data || error.message,
      status: error.response?.status,
    });
  }
});

///////////////////////////////////////////// API Route to update booking details by user (date, time, room)

app.put("/update-byuser/:id", authenticateToken, async (req, res) => {
  const { room, date, startTime, endTime } = req.body;
  const bookingId = req.params.id;

  try {
    const conflictingBooking = await Booking.findOne({
      _id: { $ne: bookingId },
      room,
      date,
      status: { $ne: "cancelled" },
      $or: [
        {
          startTime: { $lt: endTime },
          endTime: { $gt: startTime },
        },
        {
          startTime: { $eq: startTime },
          endTime: { $eq: endTime },
        },
      ],
    });

    if (conflictingBooking) {
      return res.status(409).json({ message: "Booking conflict detected." });
    }

    // Only update the fields, do NOT change status, do NOT send email
    const updated = await Booking.findByIdAndUpdate(
      bookingId,
      { room, date, startTime, endTime, editedAt: new Date() },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Booking not found." });
    }

    // Do NOT send any email here

    res.json(updated);
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});
//////////////////////////////////////////////////////////////////////  Edit booking by admin
app.post("/api/booking/edit", authenticateToken, async (req, res) => {
  const { bookingId, room, date, startTime, endTime, remark } = req.body;

  // Validate start time and end time
  if (startTime === endTime) {
    return res.status(400).send("Start time cannot be equal to end time");
  }

  if (new Date(date) < new Date()) {
    return res.status(400).send("Cannot edit booking to a past date");
  }

  if (new Date(endTime) <= new Date(startTime)) {
    return res
      .status(400)
      .send("End time cannot be earlier or equal to start time");
  }

  //Check for booking conflicts
  const conflictingBookings = await Booking.find({
    date,
    room,
    status: { $in: BOOKING_CONFLICT_STATUSES },
    $or: [
      { startTime: { $lt: endTime }, endTime: { $gt: startTime } },
      { startTime: { $gte: startTime, $lt: endTime } },
    ],
  });

  if (conflictingBookings.length > 0) {
    return res
      .status(400)
      .send("This room is already booked during the specified time");
  }

  try {
    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      {
        room,
        date,
        startTime,
        endTime,
        remark,
      },
      { new: true }
    );

    res.json(updatedBooking);
  } catch (err) {
    res.status(500).send("Error updating booking");
  }
});

/////////////////////////////////////////////////////////////// Close booking
app.post("/api/booking/close", authenticateToken, async (req, res) => {
  const { bookingId } = req.body;

  try {
    const booking = await Booking.findById(bookingId);
    if (!booking || booking.status !== "ongoing") {
      return res.status(400).send("Only ongoing bookings can be closed");
    }

    booking.status = "completed";
    await booking.save();

    res.json({ message: "Booking closed successfully" });
  } catch (err) {
    res.status(500).send("Error closing booking");
  }
});

// Get only successful bookings (approved)
app.get("/api/booking/successful", async (req, res) => {
  try {
    const successfulBookings = await Booking.find({ status: "approved" });
    res.status(200).json(successfulBookings);
  } catch (err) {
    res.status(500).send({ error: "Failed to fetch successful bookings" });
  }
});

// Get employee-specific bookings with optional date range filtering
app.get("/api/booking/employee/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate } = req.query;

    // Build filter object
    const filter = { employeeId: employeeId };

    // Add date range filtering if provided
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        filter.date.$gte = startDate;
      }
      if (endDate) {
        filter.date.$lte = endDate;
      }
    }

    // Fetch bookings matching the filter, sorted by date and time
    const bookings = await Booking.find(filter).sort({
      date: -1,
      startTime: -1,
    });

    res.json(bookings);
  } catch (error) {
    console.error("Error fetching employee bookings:", error);
    res
      .status(500)
      .json({ message: "Error fetching employee bookings", error: error.message });
  }
});

// Get all bookings (GET)
// In your backend (Express.js route handler)
app.get("/api/booking", async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ date: -1, startTime: -1 }); // Sort by date and time in descending order
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: "Error fetching bookings" });
  }
});

// === ANALYTICS ENDPOINTS ===

// Get dashboard analytics
app.get("/api/analytics/dashboard", authenticateToken, async (req, res) => {
  try {
    const { timeRange = 30, room, status } = req.query;

    // Calculate date range
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(timeRange));

    // Build filter
    const filter = {
      date: { $gte: cutoffDate.toISOString().split("T")[0] },
    };

    if (room && room !== "all") {
      filter.room = room;
    }

    if (status && status !== "all") {
      filter.status = status;
    }

    const bookings = await Booking.find(filter).sort({
      date: -1,
      startTime: -1,
    });

    // Calculate analytics
    const analytics = {
      totalBookings: bookings.length,
      statusCounts: {},
      roomCounts: {},
      dailyBookings: {},
      userCounts: {},
      meetingTypeCounts: {},
      approvalTimeData: [],
      topUsers: [],
      roomUtilization: [],
      trends: {
        daily: {},
        weekly: {},
        monthly: {},
      },
    };

    bookings.forEach((booking) => {
      // Status counts
      analytics.statusCounts[booking.status] =
        (analytics.statusCounts[booking.status] || 0) + 1;

      // Room counts
      analytics.roomCounts[booking.room] =
        (analytics.roomCounts[booking.room] || 0) + 1;

      // Daily bookings
      analytics.dailyBookings[booking.date] =
        (analytics.dailyBookings[booking.date] || 0) + 1;

      // User counts
      analytics.userCounts[booking.empName] =
        (analytics.userCounts[booking.empName] || 0) + 1;

      // Meeting type counts
      analytics.meetingTypeCounts[booking.meetingType] =
        (analytics.meetingTypeCounts[booking.meetingType] || 0) + 1;

      // Approval time analysis
      if (booking.approvedAt && booking.submittedAt) {
        const approvalTime =
          new Date(booking.approvedAt) - new Date(booking.submittedAt);
        analytics.approvalTimeData.push(approvalTime / (1000 * 60 * 60)); // Convert to hours
      }

      // Trends
      const date = new Date(booking.date);
      const weekKey = `${date.getFullYear()}-W${Math.ceil(
        (date.getDate() + date.getDay()) / 7
      )}`;
      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;

      analytics.trends.daily[booking.date] =
        (analytics.trends.daily[booking.date] || 0) + 1;
      analytics.trends.weekly[weekKey] =
        (analytics.trends.weekly[weekKey] || 0) + 1;
      analytics.trends.monthly[monthKey] =
        (analytics.trends.monthly[monthKey] || 0) + 1;
    });

    // Calculate top users
    analytics.topUsers = Object.entries(analytics.userCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([user, count]) => ({ user, count }));

    // Calculate room utilization
    analytics.roomUtilization = Object.entries(analytics.roomCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([room, count]) => ({ room, count }));

    // Calculate KPIs
    const approvedBookings = analytics.statusCounts.approved || 0;
    const pendingBookings = analytics.statusCounts.pending || 0;
    const declinedBookings = analytics.statusCounts.declined || 0;
    const completedBookings = analytics.statusCounts.completed || 0;

    analytics.kpis = {
      approvalRate:
        analytics.totalBookings > 0
          ? ((approvedBookings / analytics.totalBookings) * 100).toFixed(1)
          : 0,
      declineRate:
        analytics.totalBookings > 0
          ? ((declinedBookings / analytics.totalBookings) * 100).toFixed(1)
          : 0,
      completionRate:
        analytics.totalBookings > 0
          ? ((completedBookings / analytics.totalBookings) * 100).toFixed(1)
          : 0,
      avgApprovalTime:
        analytics.approvalTimeData.length > 0
          ? (
              analytics.approvalTimeData.reduce((a, b) => a + b, 0) /
              analytics.approvalTimeData.length
            ).toFixed(1)
          : 0,
      pendingBookings,
      approvedBookings,
      declinedBookings,
      completedBookings,
    };

    res.json(analytics);
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ message: "Error fetching analytics data" });
  }
});

// Get user analytics
app.get("/api/analytics/users", authenticateToken, async (req, res) => {
  try {
    const { timeRange = 30 } = req.query;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(timeRange));

    const bookings = await Booking.find({
      date: { $gte: cutoffDate.toISOString().split("T")[0] },
    });

    const userStats = {};

    bookings.forEach((booking) => {
      if (!userStats[booking.empName]) {
        userStats[booking.empName] = {
          totalBookings: 0,
          approvedBookings: 0,
          pendingBookings: 0,
          declinedBookings: 0,
          completedBookings: 0,
          totalHours: 0,
          roomsUsed: new Set(),
          meetingTypes: new Set(),
          averageDuration: 0,
        };
      }

      const stats = userStats[booking.empName];
      stats.totalBookings++;
      stats[`${booking.status}Bookings`]++;
      stats.roomsUsed.add(booking.room);
      stats.meetingTypes.add(booking.meetingType);

      // Calculate duration
      const startTime = new Date(`2000-01-01T${booking.startTime}`);
      const endTime = new Date(`2000-01-01T${booking.endTime}`);
      const duration = (endTime - startTime) / (1000 * 60 * 60); // hours
      stats.totalHours += duration;
    });

    // Calculate averages and convert sets to arrays
    const userAnalytics = Object.entries(userStats).map(([user, stats]) => ({
      user,
      totalBookings: stats.totalBookings,
      approvedBookings: stats.approvedBookings,
      pendingBookings: stats.pendingBookings,
      declinedBookings: stats.declinedBookings,
      completedBookings: stats.completedBookings,
      approvalRate: (
        (stats.approvedBookings / stats.totalBookings) *
        100
      ).toFixed(1),
      totalHours: stats.totalHours.toFixed(1),
      averageDuration: (stats.totalHours / stats.totalBookings).toFixed(1),
      roomsUsed: Array.from(stats.roomsUsed),
      meetingTypes: Array.from(stats.meetingTypes),
      uniqueRooms: stats.roomsUsed.size,
      uniqueMeetingTypes: stats.meetingTypes.size,
    }));

    res.json(userAnalytics);
  } catch (error) {
    console.error("User analytics error:", error);
    res.status(500).json({ message: "Error fetching user analytics" });
  }
});

// Get room analytics
app.get("/api/analytics/rooms", authenticateToken, async (req, res) => {
  try {
    const { timeRange = 30 } = req.query;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(timeRange));

    const bookings = await Booking.find({
      date: { $gte: cutoffDate.toISOString().split("T")[0] },
    });

    const roomStats = {};

    bookings.forEach((booking) => {
      if (!roomStats[booking.room]) {
        roomStats[booking.room] = {
          totalBookings: 0,
          totalHours: 0,
          users: new Set(),
          statuses: {},
          meetingTypes: {},
          averageDuration: 0,
          utilizationRate: 0,
        };
      }

      const stats = roomStats[booking.room];
      stats.totalBookings++;
      stats.users.add(booking.empName);
      stats.statuses[booking.status] =
        (stats.statuses[booking.status] || 0) + 1;
      stats.meetingTypes[booking.meetingType] =
        (stats.meetingTypes[booking.meetingType] || 0) + 1;

      // Calculate duration
      const startTime = new Date(`2000-01-01T${booking.startTime}`);
      const endTime = new Date(`2000-01-01T${booking.endTime}`);
      const duration = (endTime - startTime) / (1000 * 60 * 60); // hours
      stats.totalHours += duration;
    });

    // Calculate averages and utilization rates
    const roomAnalytics = Object.entries(roomStats).map(([room, stats]) => {
      const averageDuration =
        stats.totalBookings > 0 ? stats.totalHours / stats.totalBookings : 0;
      const utilizationRate =
        (stats.totalHours / (parseInt(timeRange) * 24)) * 100; // Assuming 24-hour availability

      return {
        room,
        totalBookings: stats.totalBookings,
        totalHours: stats.totalHours.toFixed(1),
        averageDuration: averageDuration.toFixed(1),
        utilizationRate: utilizationRate.toFixed(1),
        uniqueUsers: stats.users.size,
        users: Array.from(stats.users),
        statuses: stats.statuses,
        meetingTypes: stats.meetingTypes,
        mostUsedStatus:
          Object.entries(stats.statuses).sort(
            ([, a], [, b]) => b - a
          )[0]?.[0] || "N/A",
        mostUsedType:
          Object.entries(stats.meetingTypes).sort(
            ([, a], [, b]) => b - a
          )[0]?.[0] || "N/A",
      };
    });

    res.json(roomAnalytics);
  } catch (error) {
    console.error("Room analytics error:", error);
    res.status(500).json({ message: "Error fetching room analytics" });
  }
});

// Get trends analytics
app.get("/api/analytics/trends", authenticateToken, async (req, res) => {
  try {
    const { timeRange = 30, groupBy = "daily" } = req.query;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(timeRange));

    const bookings = await Booking.find({
      date: { $gte: cutoffDate.toISOString().split("T")[0] },
    });

    const trends = {
      daily: {},
      weekly: {},
      monthly: {},
      statusTrends: {},
      roomTrends: {},
      meetingTypeTrends: {},
    };

    bookings.forEach((booking) => {
      const date = new Date(booking.date);
      const dayKey = booking.date;
      const weekKey = `${date.getFullYear()}-W${Math.ceil(
        (date.getDate() + date.getDay()) / 7
      )}`;
      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;

      // Daily trends
      if (!trends.daily[dayKey]) {
        trends.daily[dayKey] = {
          bookings: 0,
          hours: 0,
          statuses: {},
          rooms: {},
        };
      }
      trends.daily[dayKey].bookings++;

      // Calculate hours
      const startTime = new Date(`2000-01-01T${booking.startTime}`);
      const endTime = new Date(`2000-01-01T${booking.endTime}`);
      const duration = (endTime - startTime) / (1000 * 60 * 60);
      trends.daily[dayKey].hours += duration;

      // Status trends
      trends.daily[dayKey].statuses[booking.status] =
        (trends.daily[dayKey].statuses[booking.status] || 0) + 1;
      trends.daily[dayKey].rooms[booking.room] =
        (trends.daily[dayKey].rooms[booking.room] || 0) + 1;

      // Weekly trends
      if (!trends.weekly[weekKey]) {
        trends.weekly[weekKey] = { bookings: 0, hours: 0 };
      }
      trends.weekly[weekKey].bookings++;
      trends.weekly[weekKey].hours += duration;

      // Monthly trends
      if (!trends.monthly[monthKey]) {
        trends.monthly[monthKey] = { bookings: 0, hours: 0 };
      }
      trends.monthly[monthKey].bookings++;
      trends.monthly[monthKey].hours += duration;
    });

    // Convert to arrays and sort
    const trendsData = {
      daily: Object.entries(trends.daily)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, data]) => ({
          date,
          bookings: data.bookings,
          hours: data.hours.toFixed(1),
          statuses: data.statuses,
          rooms: data.rooms,
        })),
      weekly: Object.entries(trends.weekly)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([week, data]) => ({
          week,
          bookings: data.bookings,
          hours: data.hours.toFixed(1),
        })),
      monthly: Object.entries(trends.monthly)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({
          month,
          bookings: data.bookings,
          hours: data.hours.toFixed(1),
        })),
    };

    res.json(trendsData);
  } catch (error) {
    console.error("Trends analytics error:", error);
    res.status(500).json({ message: "Error fetching trends analytics" });
  }
});

// Get export data for reports
app.get("/api/analytics/export", authenticateToken, async (req, res) => {
  try {
    const { timeRange = 30, reportType = "summary" } = req.query;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(timeRange));

    const bookings = await Booking.find({
      date: { $gte: cutoffDate.toISOString().split("T")[0] },
    }).sort({ date: -1, startTime: -1 });

    let exportData = {
      metadata: {
        generatedAt: new Date().toISOString(),
        timeRange: `${timeRange} days`,
        totalBookings: bookings.length,
        reportType,
      },
    };

    switch (reportType) {
      case "detailed":
        exportData.bookings = bookings.map((booking) => ({
          id: booking._id,
          employeeName: booking.empName,
          employeeId: booking.employeeId,
          date: booking.date,
          startTime: booking.startTime,
          endTime: booking.endTime,
          room: booking.room,
          status: booking.status,
          meetingType: booking.meetingType,
          agenda: booking.ma,
          submittedAt: booking.submittedAt,
          approvedAt: booking.approvedAt,
          approvedBy: booking.approvedBy,
          duration: booking.duration || "N/A",
        }));
        break;

      case "summary":
        const statusCounts = {};
        const roomCounts = {};
        const userCounts = {};

        bookings.forEach((booking) => {
          statusCounts[booking.status] =
            (statusCounts[booking.status] || 0) + 1;
          roomCounts[booking.room] = (roomCounts[booking.room] || 0) + 1;
          userCounts[booking.empName] = (userCounts[booking.empName] || 0) + 1;
        });

        exportData.summary = {
          statusBreakdown: statusCounts,
          roomUtilization: roomCounts,
          topUsers: Object.entries(userCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([user, count]) => ({ user, count })),
        };
        break;

      default:
        exportData.bookings = bookings;
    }

    res.json(exportData);
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ message: "Error generating export data" });
  }
});

// Delete a booking (DELETE)
app.delete("/api/booking/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedBooking = await Booking.findByIdAndDelete(id);
    if (!deletedBooking) {
      return res.status(404).send({ message: "Booking not found" });
    }
    res.status(200).send({ message: "Booking deleted successfully" });
  } catch (err) {
    res.status(500).send({ message: "Error deleting booking" });
  }
});

////////////////////////////////////////////////////// Define the Query model
const querySchema = new mongoose.Schema({
  empName: String,
  email: String,
  query: String,
  ExtensionNo: String,
});

const Query = mongoose.model("Query", querySchema);

// Send Query  email function
const sendQueryEmail = (email, queryDetails) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER1,
    subject: "Query Regarding Email TEST MAIL ",
    text: ` Dear Booking Team ,\n\n I'm Facing Error During Booking Meeting \n\nError: ${queryDetails.query},\n\nName :-${queryDetails.empName},\n\nEmail ID:-  ${queryDetails.email} \n\nExtension No:- ${queryDetails.ExtensionNo}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log("Error sending email:", error);
    } else {
      console.log("Email sent: " + info.response);
    }
  });
};

// POST route to handle query submission
app.post("/api/query", async (req, res) => {
  const { empName, email, query, ExtensionNo } = req.body;

  if (!empName || !email || !query || !ExtensionNo) {
    return res.status(400).json({ error: "All fields are required!" });
  }

  try {
    // Save the query to the database (optional)
    const newQuery = new Query({ empName, email, query, ExtensionNo });
    await newQuery.save();

    // Send the query via email
    sendQueryEmail(email, { empName, query, ExtensionNo, email });

    res.status(200).json({ message: "Query submitted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to submit the query" });
  }
});




const csv = require('csvtojson');

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['text/csv', 'application/vnd.ms-excel'];
  if (allowedMimeTypes.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV files are allowed'), false);
  }
};


// Mongoose Schema
const emailEntrySchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      trim: true,
      default: '',
      maxlength: [50, 'First name cannot exceed 50 characters'],
      validate: {
        validator: function(value) {
          // If firstName is provided, it must be at least 2 characters
          return !value || value.length >= 2;
        },
        message: 'First name must be at least 2 characters if provided'
      }
    },
    lastName: {
      type: String,
      trim: true,
      default: '',
      maxlength: [50, 'Last name cannot exceed 50 characters'],
      validate: {
        validator: function(value) {
          // If lastName is provided, it must be at least 2 characters
          return !value || value.length >= 2;
        },
        message: 'Last name must be at least 2 characters if provided'
      }
    },
    emailId: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: function(email) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },
        message: 'Please provide a valid email address'
      }
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Custom validator to ensure at least one name is provided
emailEntrySchema.pre('save', function(next) {
  if (!this.firstName && !this.lastName) {
    return next(new Error('At least first name OR last name is required'));
  }
  next();
});

// Index for better query performance
emailEntrySchema.index({ emailId: 1 }, { unique: true });
emailEntrySchema.index({ createdAt: -1 });

const EmailEntry = mongoose.model("EmailEntry", emailEntrySchema);

// Validation middleware for single entry
const validateEmailEntry = (req, res, next) => {
  const { firstName, lastName, emailId } = req.body;
  const errors = [];

  // At least one of firstName or lastName must be provided
  if (!firstName && !lastName) {
    errors.push('At least first name OR last name is required');
  }
  
  // If firstName is provided, validate it
  if (firstName && firstName.toString().trim().length < 2) {
    errors.push('First name must be at least 2 characters if provided');
  }
  
  // If lastName is provided, validate it
  if (lastName && lastName.toString().trim().length < 2) {
    errors.push('Last name must be at least 2 characters if provided');
  }
  
  if (!emailId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailId)) {
    errors.push('Please provide a valid email address');
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  next();
};

// Routes

/* ➕ Add Single Entry */
app.post("/api/email-entry/add", validateEmailEntry, async (req, res) => {
  try {
    const { firstName, lastName, emailId } = req.body;
    
    // Check if email already exists
    const existingEntry = await EmailEntry.findOne({ emailId: emailId.toLowerCase() });
    if (existingEntry) {
      return res.status(409).json({ 
        error: 'Email already exists',
        existingEntry 
      });
    }

    const entry = new EmailEntry({ 
      firstName: firstName ? firstName.trim() : '', 
      lastName: lastName ? lastName.trim() : '', 
      emailId: emailId.toLowerCase().trim() 
    });
    
    await entry.save();

    res.status(201).json({ 
      message: "Entry added successfully",
      data: entry
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    res.status(400).json({ error: err.message });
  }
});

/* 📤 Bulk Upload CSV */
/* 📤 Bulk Upload CSV - Allow missing first OR last name */
app.post("/api/email-entry/bulk-upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ 
      error: 'No file uploaded',
      message: 'Please select a CSV file to upload' 
    });
  }

  let fileCleanedUp = false;
  
  try {
    // Parse CSV with csvtojson
    const csvData = await csv({
      trim: true,
      ignoreEmpty: true,
      checkType: true,
      flatKeys: true
    }).fromFile(req.file.path);
    
    if (!csvData.length) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'CSV file is empty' });
    }

    const results = {
      total: csvData.length,
      successful: 0,
      failed: 0,
      duplicates: 0,
      invalid: 0,
      errors: [],
      successfulEntries: []
    };

    // Process each row
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const rowNumber = i + 2;
      
      // Extract and normalize values (case-insensitive column names)
      const firstName = (
        row.firstName || 
        row['first name'] || 
        row['First Name'] || 
        row.FIRSTNAME || 
        row.fname || 
        ''
      ).toString().trim();
      
      const lastName = (
        row.lastName || 
        row['last name'] || 
        row['Last Name'] || 
        row.LASTNAME || 
        row.lname || 
        ''
      ).toString().trim();
      
      const emailId = (
        row.emailId || 
        row.email || 
        row['email address'] || 
        row.Email || 
        row.EMAIL || 
        ''
      ).toString().trim().toLowerCase();

      // VALIDATION RULES:
      // 1. Email is REQUIRED
      // 2. At least ONE of firstName OR lastName is required
      // 3. Email must be valid format

      // Check 1: Email is required
      if (!emailId) {
        results.errors.push(`Row ${rowNumber}: Email is required`);
        results.invalid++;
        results.failed++;
        continue;
      }

      // Check 2: Email format validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailId)) {
        results.errors.push(`Row ${rowNumber}: Invalid email format - ${emailId}`);
        results.invalid++;
        results.failed++;
        continue;
      }

      // Check 3: At least firstName OR lastName must be provided
      if (!firstName && !lastName) {
        results.errors.push(`Row ${rowNumber}: At least first name OR last name is required`);
        results.invalid++;
        results.failed++;
        continue;
      }

      // Check 4: If firstName is provided, it should be at least 2 chars
      if (firstName && firstName.length < 1) {
        results.errors.push(`Row ${rowNumber}: First name must be at least 2 characters if provided`);
        results.invalid++;
        results.failed++;
        continue;
      }

      // Check 5: If lastName is provided, it should be at least 2 chars
      if (lastName && lastName.length < 1) {
        results.errors.push(`Row ${rowNumber}: Last name must be at least 2 characters if provided`);
        results.invalid++;
        results.failed++;
        continue;
      }

      // Check for duplicates in this batch
      const duplicateInBatch = csvData.slice(0, i).some((existingRow, existingIndex) => {
        const existingEmail = (
          existingRow.emailId || 
          existingRow.email || 
          existingRow['email address'] || 
          ''
        ).toString().trim().toLowerCase();
        return existingEmail === emailId;
      });
      
      if (duplicateInBatch) {
        results.errors.push(`Row ${rowNumber}: Duplicate email in CSV - ${emailId}`);
        results.duplicates++;
        results.failed++;
        continue;
      }

      try {
        // Check if email exists in database
        const existingEntry = await EmailEntry.findOne({ emailId });
        
        if (existingEntry) {
          results.errors.push(`Row ${rowNumber}: Email already exists - ${emailId}`);
          results.duplicates++;
          results.failed++;
          continue;
        }

        // Create and save new entry
        const newEntry = new EmailEntry({
          firstName: firstName || '', // Save empty string if not provided
          lastName: lastName || '',   // Save empty string if not provided
          emailId: emailId
        });
        
        await newEntry.save();
        results.successfulEntries.push(newEntry);
        results.successful++;
        
      } catch (err) {
        if (err.code === 11000) {
          results.errors.push(`Row ${rowNumber}: Email already exists - ${emailId}`);
          results.duplicates++;
        } else {
          results.errors.push(`Row ${rowNumber}: ${err.message}`);
        }
        results.failed++;
      }
    }

    // Clean up uploaded file
    try {
      fs.unlinkSync(req.file.path);
      fileCleanedUp = true;
    } catch (cleanupError) {
      console.warn('Could not delete uploaded file:', cleanupError.message);
    }

    // Prepare response
    const response = {
      message: results.successful > 0 ? 'CSV processing completed' : 'No valid data processed',
      summary: {
        totalRows: results.total,
        successful: results.successful,
        failed: results.failed,
        duplicates: results.duplicates,
        invalidRows: results.invalid
      }
    };

    // Include errors if any
    if (results.errors.length > 0) {
      response.errors = results.errors.slice(0, 10);
      if (results.errors.length > 10) {
        response.errors.push(`... and ${results.errors.length - 10} more errors`);
      }
    }

    // Include sample of successful entries
    if (results.successfulEntries.length > 0 && results.successfulEntries.length <= 5) {
      response.sampleEntries = results.successfulEntries.slice(0, 5).map(entry => ({
        firstName: entry.firstName || '(Not Provided)',
        lastName: entry.lastName || '(Not Provided)',
        emailId: entry.emailId
      }));
    }

    // Return appropriate status code
    const statusCode = results.successful === 0 ? 400 : 
                      results.failed > 0 ? 207 : 200;
    
    res.status(statusCode).json(response);

  } catch (err) {
    // Clean up file if not already done
    if (!fileCleanedUp && req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError);
      }
    }

    console.error('Bulk upload error:', err);
    
    let errorMessage = 'Failed to process CSV file';
    let statusCode = 500;

    if (err.message.includes('CSV')) {
      errorMessage = 'Invalid CSV file format';
      statusCode = 400;
    } else if (err.message.includes('Only CSV files')) {
      errorMessage = 'Please upload a valid CSV file';
      statusCode = 400;
    }

    res.status(statusCode).json({
      error: errorMessage,
      message: err.message
    });
  }
});

/* 📥 Fetch All with Pagination */
app.get("/api/email-entry/list", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';
    
    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({ 
        error: 'Invalid pagination parameters. Page must be ≥1, limit between 1-100' 
      });
    }

    const skip = (page - 1) * limit;

    // Build search query
    const query = {};
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { emailId: { $regex: search, $options: 'i' } }
      ];
    }

    // Execute queries in parallel
    const [data, total] = await Promise.all([
      EmailEntry.find(query)
        .sort()
        .skip(skip)
        .limit(limit)
        .select('-__v'), // Exclude version key
      EmailEntry.countDocuments(query)
    ]);

    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      },
      search: search || null
    });
  } catch (err) {
    console.error('List error:', err);
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

/* � Export to CSV */
app.get("/api/email-entry/export-csv", async (req, res) => {
  try {
    const entries = await EmailEntry.find()
      .sort({ createdAt: -1 })
      .lean();

    if (!entries.length) {
      return res.status(404).json({ error: 'No entries to export' });
    }

    // Create CSV content
    const headers = ['First Name', 'Last Name', 'Email Address', 'Date Added'];
    const rows = entries.map(entry => [
      entry.firstName || '',
      entry.lastName || '',
      entry.emailId,
      entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        // Escape quotes and wrap in quotes if contains comma
        const escaped = cell.toString().replace(/"/g, '""');
        return escaped.includes(',') ? `"${escaped}"` : escaped;
      }).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="email-entries.csv"');
    res.send(csvContent);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

/* �🔍 Get Single Entry by Email */
app.get("/api/email-entry/:email", async (req, res) => {
  try {
    const entry = await EmailEntry.findOne({ 
      emailId: req.params.email.toLowerCase() 
    });
    
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ✏️ Update Entry */
app.put("/api/email-entry/:id", async (req, res) => {
  try {
    const { firstName, lastName, emailId } = req.body;
    
    // Check if new email already exists (excluding current entry)
    if (emailId) {
      const existing = await EmailEntry.findOne({ 
        emailId: emailId.toLowerCase(),
        _id: { $ne: req.params.id }
      });
      
      if (existing) {
        return res.status(409).json({ error: 'Email already exists' });
      }
    }

    const updatedEntry = await EmailEntry.findByIdAndUpdate(
      req.params.id,
      { 
        $set: {
          ...(firstName && { firstName: firstName.trim() }),
          ...(lastName && { lastName: lastName.trim() }),
          ...(emailId && { emailId: emailId.toLowerCase().trim() })
        }
      },
      { new: true, runValidators: true }
    );

    if (!updatedEntry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json({
      message: 'Entry updated successfully',
      data: updatedEntry
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

/* 🗑️ Delete Entry */
app.delete("/api/email-entry/:id", async (req, res) => {
  try {
    const deletedEntry = await EmailEntry.findByIdAndDelete(req.params.id);
    
    if (!deletedEntry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json({
      message: 'Entry deleted successfully',
      deletedEntry: {
        id: deletedEntry._id,
        email: deletedEntry.emailId
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* 📊 Get Statistics */
app.get("/api/email-entry/stats", async (req, res) => {
  try {
    const [totalEntries, latestEntry, oldestEntry] = await Promise.all([
      EmailEntry.countDocuments(),
      EmailEntry.findOne().sort({ createdAt: -1 }).select('createdAt'),
      EmailEntry.findOne().sort({ createdAt: 1 }).select('createdAt')
    ]);

    res.json({
      totalEntries,
      latestEntryDate: latestEntry?.createdAt || null,
      oldestEntryDate: oldestEntry?.createdAt || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ✅ Correct path to frontend/build
app.use(express.static(path.join(__dirname, "../frontend/build")));

// ✅ Catch-all route to serve index.html for React Router
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/build/index.html"));
});

// Catch-all 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: "404 Not Found - The requested resource doesn't exist.",
  });
});

// === START HTTPS SERVER AFTER DATABASE AND ADMIN BOOTSTRAP ===
async function startServer() {
  try {
    await mongoose.connect(
      process.env.MONGO_URI || "mongodb://localhost:27017/employeeDB"
    );
    console.log("MongoDB connected");
    await ensureDefaultAdmin();

    const port = process.env.PORT || 5000;
    https
      .createServer(
        { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) },
        app
      )
      .listen(port, "0.0.0.0", () => {
        console.log(`Server also accessible at https://192.168.0.150:${port}`);
      });
  } catch (err) {
    console.error("Server startup failed:", err.message);
    process.exit(1);
  }
}

startServer();
