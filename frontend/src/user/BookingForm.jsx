import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import "./BookingForm.css";
import CreatableSelect from "react-select/creatable";
import {jwtDecode }from "jwt-decode";
import debounce from "lodash/debounce";
import { motion, AnimatePresence } from "framer-motion";
import {
  Box,
  Typography,
  TextField,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Alert,
  AlertTitle,
  Divider,
  LinearProgress,
  InputAdornment,
  Avatar,
  Skeleton,
  Container,
  Paper,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  AccessTime as AccessTimeIcon,
  Person as PersonIcon,
  Description as DescriptionIcon,
  Refresh as RefreshIcon,
  Cancel as CancelIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Send as SendIcon,
  MeetingRoom as MeetingRoomIcon,
  History as HistoryIcon,
  Badge as BadgeIcon,
  CheckCircle as CheckCircleIcon,
  EventBusy as EventBusyIcon,
  Timeline as TimelineIcon,
  Schedule as ScheduleIcon,
  Today as TodayIcon,
} from "@mui/icons-material";
import RoomSelectionModal from "./RoomSelectionModal";
import { ThemeProvider, createTheme } from "@mui/material/styles";

// ============================================
// API & UTILS
// ============================================
const API_BASE = process.env.REACT_APP_API_URL || "https://01-30225:1010/api";
const api = axios.create({ baseURL: API_BASE, timeout: 15000 });
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const getArray = (data, keys = []) => {
  if (Array.isArray(data)) return data;
  for (const key of keys) if (Array.isArray(data?.[key])) return data[key];
  return Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.results)
      ? data.results
      : [];
};

const normDate = (v) =>
  !v ? "" : String(v).match(/^\d{4}-\d{2}-\d{2}/)?.[0] || "";
const normText = (v) =>
  String(v || "")
    .trim()
    .toLowerCase();
const overlap = (s1, e1, s2, e2) => s1 < e2 && e1 > s2;
const sameRoom = (a, b) => normText(a) === normText(b);
const sameDate = (a, b) => normDate(a) === normDate(b);
const blockingStatus = (s) => ["approved", "ongoing"].includes(normText(s));

const statusColor = (s) =>
  ({
    approved: { bg: "#E8F5E9", text: "#2E7D32", border: "#A5D6A7" },
    pending: { bg: "#FFF3E0", text: "#E65100", border: "#FFCC80" },
    cancelled: { bg: "#FCE4EC", text: "#C2185B", border: "#F48FB1" },
    ongoing: { bg: "#E3F2FD", text: "#1565C0", border: "#90CAF9" },
    completed: { bg: "#E8F5E9", text: "#1B5E20", border: "#A5D6A7" },
  })[normText(s)] || { bg: "#F5F5F5", text: "#165283", border: "#E0E0E0" };

const defaultRooms = [
  { _id: "admin", name: "Admin Conference Room", capacity: 35 },
  { _id: "qa-conf", name: "QA Conference Room", capacity: 25 },
  { _id: "qa-train", name: "QA Training Room", capacity: 50 },
];

// Debounced email search function (outside component to prevent recreation)
const debouncedEmailSearch = debounce(async (query, setter, loader, api) => {
  if (!query || query.length === 0) return;
  loader(true);
  try {
    const { data } = await api.get("/email-entry/list", {
      params: { search: query, limit: 50 },
    });
    setter(
      (data.data || data || []).map((e) => ({
        value: e.emailId,
        label:
          `${e.firstName || ""} ${e.lastName || ""} <${e.emailId}>`.trim(),
      })),
    );
  } catch (e) {
    console.error("Email search error:", e);
  }
  loader(false);
}, 500);

// ============================================
// CUSTOM THEME with #165283 text and white background
// ============================================
const theme = createTheme({
  palette: {
    primary: { main: "#165283" },
    secondary: { main: "#2A7FAA" },
    success: { main: "#2E7D32" },
    error: { main: "#D32F2F" },
    warning: { main: "#ED6C02" },
    info: { main: "#0288D1" },
    background: { default: "#FFFFFF", paper: "#FFFFFF" },
    text: { primary: "#165283", secondary: "#5A6B7A" },
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", "Roboto", sans-serif',
    h5: { fontWeight: 700, color: "#165283" },
    h6: { fontWeight: 600, color: "#165283" },
    button: { textTransform: "none", fontWeight: 600 },
    body1: { color: "#165283" },
    body2: { color: "#5A6B7A" },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: "0 2px 12px rgba(0, 0, 0, 0.04)",
          border: "1px solid #E8ECF0",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          padding: "10px 20px",
        },
        contained: {
          boxShadow: "none",
          "&:hover": {
            boxShadow: "0 4px 12px rgba(22, 82, 131, 0.15)",
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 10,
            "& fieldset": {
              borderColor: "#E0E6ED",
            },
            "&:hover fieldset": {
              borderColor: "#165283",
            },
          },
        },
      },
    },
  },
});

// ============================================
// MAIN COMPONENT (3 steps: Room+Schedule, Details, Review)
// ============================================
const BookingForm = () => {
  const steps = [
    { label: "Room & Schedule", icon: <MeetingRoomIcon />, color: "#165283" },
    { label: "Meeting Details", icon: <DescriptionIcon />, color: "#2A7FAA" },
    { label: "Review & Submit", icon: <CheckCircleIcon />, color: "#2E7D32" },
  ];

  const [activeStep, setActiveStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [form, setForm] = useState({
    empName: "",
    employeeId: "",
    date: "",
    startTime: "",
    endTime: "",
    email: "",
    room: "",
    ma: "",
    bookedBy: "",
    cc: [],
  });
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [recurrence, setRecurrence] = useState({ type: "none", endDate: "" });
  const [emailOptions, setEmailOptions] = useState([]);
  const [emailLoading, setEmailLoading] = useState(false);
  const [allEmployees, setAllEmployees] = useState([]);

  const setField = (field) => (value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // Helper to get bookedBy reliably
  const getBookedBy = useCallback(() => {
    if (form.bookedBy) return form.bookedBy;
    const token = sessionStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        return decoded.employeeId || decoded.sub || "";
      } catch (e) {
        console.error("Token decode failed:", e);
      }
    }
    return "";
  }, [form.bookedBy]);

  const selectedBookings = useMemo(
    () =>
      bookings
        .filter(
          (b) =>
            sameRoom(b.room, form.room) &&
            sameDate(b.date, form.date) &&
            ["pending", "approved", "ongoing", "completed"].includes(
              normText(b.status),
            ),
        )
        .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime))),
    [bookings, form.room, form.date],
  );

  const calculateDuration = (s, e) => {
    if (!s || !e) return "0h 0m";
    const diff = new Date(`2000-01-01T${e}`) - new Date(`2000-01-01T${s}`);
    return `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`;
  };

  const progress = useMemo(() => {
    const fields = [
      form.date,
      form.room,
      form.startTime,
      form.endTime,
      form.empName,
      form.employeeId,
      form.email,
      form.ma,
    ];
    const filled = fields.filter(Boolean).length;
    return Math.min(
      100,
      (filled / fields.length) * 85 + (activeStep === 2 ? 15 : 0),
    );
  }, [activeStep, form]);

  // ============================================
  // DATA FETCHING
  // ============================================
  const fetchBookings = useCallback(async () => {
    try {
      const { data } = await api.get("/booking", {
        params: {
          limit: 100,
          room: form.room,
          date: form.date,
          status: "pending,approved,ongoing,completed",
        },
      });
      setBookings(getArray(data, ["bookings"]));
    } catch (e) {
      console.error(e);
    }
  }, [form.room, form.date]);

  const checkConflicts = useCallback(async () => {
    if (!form.room || !form.date || !form.startTime || !form.endTime) return;
    setCheckingConflicts(true);
    try {
      const { data } = await api.get("/booking", { params: { limit: 100 } });
      const all = getArray(data, ["bookings"]);
      const conflicts = all.filter(
        (b) =>
          sameRoom(b.room, form.room) &&
          sameDate(b.date, form.date) &&
          blockingStatus(b.status) &&
          overlap(b.startTime, b.endTime, form.startTime, form.endTime),
      );
      setConflict(
        conflicts.length
          ? "Time conflict detected! This slot overlaps with an existing booking."
          : "",
      );
    } catch (e) {
      console.error(e);
    } finally {
      setCheckingConflicts(false);
    }
  }, [form.room, form.date, form.startTime, form.endTime]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [{ data: r }, { data: emp }] = await Promise.all([
          api.get("/rooms", { params: { limit: 50 } }),
          api.get("/employees"),
        ]);
        setRooms(
          getArray(r, ["rooms"]).length ? getArray(r, ["rooms"]) : defaultRooms,
        );
        setAllEmployees(emp.data || emp || []);
        
        // Set bookedBy from token immediately
        const token = sessionStorage.getItem("token");
        if (token) {
          try {
            const decoded = jwtDecode(token);
            const employeeId = decoded.employeeId || decoded.sub || "";
            setForm((prev) => ({
              ...prev,
              bookedBy: employeeId,
            }));
          } catch (e) {
            console.error("Failed to decode token:", e);
          }
        }
        
        const { data: emails } = await api.get("/email-entry/list", {
          params: { limit: 50 },
        });
        setEmailOptions(
          (emails.data || emails || []).map((e) => ({
            value: e.emailId,
            label:
              `${e.firstName || ""} ${e.lastName || ""} <${e.emailId}>`.trim(),
          })),
        );
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (form.room && form.date) fetchBookings();
  }, [form.room, form.date, fetchBookings]);
  
  useEffect(() => {
    if (form.room && form.date && form.startTime && form.endTime)
      checkConflicts();
  }, [form.room, form.date, form.startTime, form.endTime, checkConflicts]);

  useEffect(() => {
    const fetchEmployee = async () => {
      if (!/^AP\d{4}$/.test(form.employeeId)) {
        setForm((prev) => ({ ...prev, empName: "", email: "" }));
        return;
      }

      const emp = allEmployees.find((e) => e.employeeId === form.employeeId);
      if (emp) {
        setForm((prev) => ({
          ...prev,
          empName: emp.name || "",
          email: emp.email || "",
        }));
        return;
      }

      try {
        const { data: fetched } = await api.get("/employees", {
          params: { employeeId: form.employeeId },
        });

        const match = Array.isArray(fetched)
          ? fetched.find((e) => e.employeeId === form.employeeId)
          : fetched;

        if (match) {
          setAllEmployees((prev) =>
            prev.some((e) => e.employeeId === match.employeeId)
              ? prev
              : [...prev, match],
          );
          setForm((prev) => ({
            ...prev,
            empName: match.name || "",
            email: match.email || "",
          }));
        } else {
          setForm((prev) => ({ ...prev, empName: "", email: "" }));
        }
      } catch (err) {
        console.error("Employee fetch failed:", err);
        setForm((prev) => ({ ...prev, empName: "", email: "" }));
      }
    };

    fetchEmployee();
  }, [form.employeeId, allEmployees]);

  // ============================================
  // HANDLERS
  // ============================================
  
  // Fixed searchEmails - using the external debounced function
  const searchEmails = useCallback((inputValue) => {
    debouncedEmailSearch(inputValue, setEmailOptions, setEmailLoading, api);
  }, []);

  const handleRoomDateSelected = () => {
    if (!form.date || !form.room) {
      setError("Please select date and room first");
      return;
    }
    setScheduleModalOpen(true);
  };

  const handleScheduleConfirm = () => {
    if (!form.startTime || !form.endTime) {
      setError("Please select start and end time");
      return;
    }
    const s = new Date(`${form.date}T${form.startTime}`);
    const e = new Date(`${form.date}T${form.endTime}`);
    if (s >= e) {
      setError("End time must be after start time");
      return;
    }
    if (s < new Date()) {
      setError("Cannot book in the past");
      return;
    }
    setError("");
    setScheduleModalOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Get bookedBy reliably
    const bookedBy = getBookedBy();
    
    // Debug log to see all form values
    console.log("Form values at submit:", {
      empName: form.empName,
      employeeId: form.employeeId,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      email: form.email,
      room: form.room,
      ma: form.ma,
      bookedBy: bookedBy,
      cc: form.cc,
    });
    
    // Check all required fields with detailed error messages
    const missingFields = [];
    if (!form.empName) missingFields.push("Employee Name");
    if (!form.employeeId) missingFields.push("Employee ID");
    if (!form.date) missingFields.push("Date");
    if (!form.startTime) missingFields.push("Start Time");
    if (!form.endTime) missingFields.push("End Time");
    if (!form.email) missingFields.push("Email");
    if (!form.room) missingFields.push("Room");
    if (!form.ma) missingFields.push("Meeting Agenda");
    if (!bookedBy) missingFields.push("User ID (Booked By)");

    if (missingFields.length > 0) {
      setError(`Missing required fields: ${missingFields.join(", ")}`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        bookedBy, // Use the reliably obtained value
        cc: form.cc.join(", "),
        ...recurrence,
      };
      
      console.log("Submitting payload:", payload);
      
      await api.post("/booking", payload);
      setSuccess("Booking submitted successfully!");
      setTimeout(() => {
        setSuccess("");
        setForm({
          empName: "",
          employeeId: "",
          date: "",
          startTime: "",
          endTime: "",
          email: "",
          room: "",
          ma: "",
          bookedBy: bookedBy, // Preserve the bookedBy value
          cc: [],
        });
        setActiveStep(0);
      }, 3000);
    } catch (err) {
      console.error("Submission error:", err);
      setError(err.response?.data?.message || "Submission failed");
    }
    setSubmitting(false);
  };

  const handleNext = () => {
    if (activeStep === 0) {
      if (!form.date || !form.room) {
        setError("Select date and room");
        return;
      }
      if (!form.startTime || !form.endTime) {
        setError("Set schedule first");
        return;
      }
      if (conflict) {
        setError("Resolve time conflict before proceeding");
        return;
      }
    }
    if (activeStep === 1) {
      if (!form.empName || !form.employeeId) {
        setError("Employee details required");
        return;
      }
      if (!form.email) {
        setError("Organizer email required");
        return;
      }
      if (!form.ma) {
        setError("Meeting agenda required");
        return;
      }
    }
    setError("");
    setDirection(1);
    setActiveStep((p) => Math.min(p + 1, 2));
  };

  const handleBack = () => {
    setError("");
    setDirection(-1);
    setActiveStep((p) => Math.max(p - 1, 0));
  };

  // ============================================
  // SCHEDULE MODAL (Time Picker + Timeline + Bookings)
  // ============================================
  const ScheduleModal = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const bookedH = new Set(
      selectedBookings
        .filter((b) => blockingStatus(b.status))
        .flatMap((b) => {
          const r = [];
          for (let h = parseInt(b.startTime); h < parseInt(b.endTime); h++)
            r.push(h);
          return r;
        }),
    );
    const selectedH = new Set(
      form.startTime && form.endTime
        ? (() => {
            const r = [];
            for (
              let h = parseInt(form.startTime);
              h < parseInt(form.endTime);
              h++
            )
              r.push(h);
            return r;
          })()
        : [],
    );
    const isToday = form.date === new Date().toISOString().split("T")[0];
    const nowH = new Date().getHours();

    return (
      <Dialog
        open={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            borderBottom: "1px solid #E8ECF0",
            pb: 2,
          }}
        >
          <AccessTimeIcon sx={{ color: "#165283" }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: "#165283" }}>
            Schedule for {form.room} on {form.date}
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: "#E8ECF0" }}>
          {/* Time Pickers */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Start Time"
                type="time"
                value={form.startTime}
                onChange={(e) => setField("startTime")(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="End Time"
                type="time"
                value={form.endTime}
                onChange={(e) => setField("endTime")(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            {form.startTime && form.endTime && (
              <Grid item xs={12}>
                <Chip
                  icon={<ScheduleIcon />}
                  label={`Duration: ${calculateDuration(form.startTime, form.endTime)}`}
                  sx={{ bgcolor: "#E8F0F7", color: "#165283", fontWeight: 500 }}
                />
              </Grid>
            )}
          </Grid>

          {/* Timeline Visualizer */}
          <Typography
            variant="subtitle2"
            fontWeight={600}
            mb={2}
            sx={{
              color: "#165283",
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <TimelineIcon sx={{ fontSize: 18 }} /> Room Availability Timeline
          </Typography>
          <Box
            sx={{
              display: "flex",
              gap: 0.5,
              overflowX: "auto",
              pb: 2,
              mb: 3,
              "&::-webkit-scrollbar": { height: 6 },
              "&::-webkit-scrollbar-track": {
                bgcolor: "#F0F2F5",
                borderRadius: 3,
              },
              "&::-webkit-scrollbar-thumb": {
                bgcolor: "#165283",
                borderRadius: 3,
              },
            }}
          >
            {hours.map((h) => {
              const booked = bookedH.has(h),
                selected = selectedH.has(h),
                past = isToday && h < nowH;
              let bgColor = "#FFFFFF",
                borderColor = "#E0E6ED",
                textColor = "#165283";
              if (booked) {
                bgColor = "#FFEBEE";
                borderColor = "#EF9A9A";
                textColor = "#C62828";
              }
              if (selected) {
                bgColor = "#E8F0F7";
                borderColor = "#165283";
                textColor = "#165283";
              }
              if (past) {
                bgColor = "#F5F5F5";
                textColor = "#9E9E9E";
              }
              return (
                <Box
                  key={h}
                  onClick={() => {
                    if (!booked && !past) {
                      const t = `${String(h).padStart(2, "0")}:00`;
                      if (!form.startTime) setField("startTime")(t);
                      else if (!form.endTime && t > form.startTime)
                        setField("endTime")(t);
                      else {
                        setField("startTime")(t);
                        setField("endTime")("");
                      }
                    }
                  }}
                  sx={{
                    width: 48,
                    height: 56,
                    borderRadius: 2,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: booked || past ? "not-allowed" : "pointer",
                    opacity: past ? 0.6 : 1,
                    flexShrink: 0,
                    bgcolor: bgColor,
                    border: `2px solid ${borderColor}`,
                    transition: "all 0.2s",
                    "&:hover": {
                      transform: !booked && !past ? "translateY(-2px)" : "none",
                      boxShadow:
                        !booked && !past
                          ? "0 4px 8px rgba(22,82,131,0.15)"
                          : "none",
                    },
                  }}
                >
                  <Typography
                    variant="caption"
                    fontWeight="bold"
                    color={textColor}
                  >
                    {String(h).padStart(2, "0")}
                  </Typography>
                  <Typography
                    variant="caption"
                    fontSize="0.6rem"
                    color={textColor}
                  >
                    {h < 12 ? "AM" : "PM"}
                  </Typography>
                  {booked && (
                    <EventBusyIcon sx={{ fontSize: 12, color: "#C62828" }} />
                  )}
                  {selected && (
                    <CheckCircleIcon sx={{ fontSize: 12, color: "#165283" }} />
                  )}
                </Box>
              );
            })}
          </Box>

          {/* Quick Select */}
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 3 }}>
            <Typography
              variant="caption"
              sx={{ alignSelf: "center", color: "#5A6B7A" }}
            >
              Quick duration:
            </Typography>
            {[
              { label: "1h", h: 1 },
              { label: "2h", h: 2 },
              { label: "4h", h: 4 },
              { label: "8h", h: 8 },
            ].map((p) => (
              <Chip
                key={p.label}
                label={p.label}
                size="small"
                variant="outlined"
                onClick={() => {
                  const s =
                    form.startTime ||
                    `${String(new Date().getHours()).padStart(2, "0")}:00`;
                  setField("endTime")(
                    `${String(parseInt(s) + p.h).padStart(2, "0")}:00`,
                  );
                }}
                sx={{
                  cursor: "pointer",
                  borderColor: "#165283",
                  color: "#165283",
                  "&:hover": { bgcolor: "#E8F0F7" },
                }}
              />
            ))}
          </Box>

          {/* Recurrence */}
          <Divider sx={{ my: 2, borderColor: "#E8ECF0" }} />
          <Typography
            variant="subtitle2"
            fontWeight={600}
            mb={2}
            sx={{ color: "#165283" }}
          >
            Recurrence Settings
          </Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <TextField
                select
                fullWidth
                label="Recurrence Type"
                value={recurrence.type}
                onChange={(e) =>
                  setRecurrence({ ...recurrence, type: e.target.value })
                }
                SelectProps={{ native: true }}
              >
                <option value="none">None</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </TextField>
            </Grid>
            {recurrence.type !== "none" && (
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="End Date"
                  value={recurrence.endDate}
                  onChange={(e) =>
                    setRecurrence({ ...recurrence, endDate: e.target.value })
                  }
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            )}
          </Grid>

          {/* Existing Bookings */}
          {selectedBookings.length > 0 && (
            <>
              <Divider sx={{ my: 2, borderColor: "#E8ECF0" }} />
              <Typography
                variant="subtitle2"
                fontWeight={600}
                mb={2}
                sx={{
                  color: "#165283",
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <HistoryIcon sx={{ fontSize: 18 }} /> Existing Bookings (
                {selectedBookings.length})
              </Typography>
              <TableContainer
                sx={{
                  maxHeight: 200,
                  borderRadius: 2,
                  border: "1px solid #E8ECF0",
                }}
              >
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ bgcolor: "#F8FAFC" }}>
                      {["Time", "Duration", "Organizer", "Status"].map((h) => (
                        <TableCell
                          key={h}
                          sx={{
                            fontWeight: 600,
                            color: "#165283",
                            fontSize: "0.75rem",
                          }}
                        >
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedBookings.map((b, i) => {
                      const sc = statusColor(b.status);
                      return (
                        <TableRow key={i}>
                          <TableCell sx={{ fontSize: "0.8rem" }}>
                            {b.startTime} - {b.endTime}
                          </TableCell>
                          <TableCell sx={{ fontSize: "0.8rem" }}>
                            {calculateDuration(b.startTime, b.endTime)}
                          </TableCell>
                          <TableCell sx={{ fontSize: "0.8rem" }}>
                            {b.empName || "N/A"}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={b.status}
                              size="small"
                              sx={{
                                bgcolor: sc.bg,
                                color: sc.text,
                                fontSize: "0.7rem",
                                height: 22,
                                fontWeight: 500,
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}

          {/* Conflict Warning */}
          {conflict && (
            <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
              <AlertTitle>Time Conflict</AlertTitle>
              {conflict}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: "1px solid #E8ECF0" }}>
          <Button
            onClick={() => setScheduleModalOpen(false)}
            sx={{ color: "#5A6B7A" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleScheduleConfirm}
            disabled={!!conflict}
            sx={{ bgcolor: "#165283", "&:hover": { bgcolor: "#0E3D61" } }}
          >
            Confirm Schedule
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  if (loading)
    return (
      <Container maxWidth="lg">
        <Box py={4}>
          <Skeleton
            variant="rectangular"
            height={120}
            sx={{ borderRadius: 3, mb: 3 }}
          />
          <Grid container spacing={3}>
            {[1, 2, 3].map((i) => (
              <Grid item xs={12} key={i}>
                <Skeleton
                  variant="rectangular"
                  height={200}
                  sx={{ borderRadius: 3 }}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      </Container>
    );

  // ============================================
  // RENDER
  // ============================================
  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ minHeight: "100vh", bgcolor: "#FFFFFF", py: 4 }}>
        <Container maxWidth="lg">
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  position: "fixed",
                  top: 20,
                  left: "50%",
                  zIndex: 9999,
                  transform: "translateX(-50%)",
                }}
              >
                <Alert
                  severity="success"
                  variant="filled"
                  sx={{ borderRadius: 3, bgcolor: "#2E7D32" }}
                  action={
                    <IconButton
                      color="inherit"
                      size="small"
                      onClick={() => setSuccess("")}
                    >
                      <CancelIcon />
                    </IconButton>
                  }
                >
                  <AlertTitle>Success!</AlertTitle>
                  {success}
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Paper sx={{ p: { xs: 3, sm: 5 }, borderRadius: 4 }}>
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}
              >
                <MeetingRoomIcon sx={{ fontSize: 32, color: "#165283" }} />
                <Typography
                  variant="h5"
                  fontWeight="bold"
                  sx={{ color: "#165283" }}
                >
                  Book a Meeting Room
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  mb: 4,
                  bgcolor: "#E8ECF0",
                  "& .MuiLinearProgress-bar": { bgcolor: "#165283" },
                }}
              />

              {/* Step Navigation */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  mb: 5,
                  position: "relative",
                }}
              >
                <Box
                  sx={{
                    position: "absolute",
                    top: 24,
                    left: 0,
                    right: 0,
                    height: 3,
                    bgcolor: "#E8ECF0",
                    borderRadius: 1.5,
                  }}
                >
                  <Box
                    sx={{
                      height: "100%",
                      width: `${(activeStep / 2) * 100}%`,
                      bgcolor: "#165283",
                      borderRadius: 1.5,
                      transition: "width 0.3s",
                    }}
                  />
                </Box>
                {steps.map((s, i) => (
                  <Box
                    key={s.label}
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      zIndex: 1,
                      cursor: i < activeStep ? "pointer" : "default",
                    }}
                    onClick={() =>
                      i < activeStep &&
                      (setDirection(i > activeStep ? 1 : -1), setActiveStep(i))
                    }
                  >
                    <Avatar
                      sx={{
                        width: 48,
                        height: 48,
                        bgcolor: i <= activeStep ? s.color : "#E8ECF0",
                        color: i <= activeStep ? "#FFFFFF" : "#9E9E9E",
                      }}
                    >
                      {i < activeStep ? <CheckCircleIcon /> : s.icon}
                    </Avatar>
                    <Typography
                      variant="caption"
                      fontWeight={i === activeStep ? 600 : 400}
                      sx={{
                        mt: 1,
                        color: i === activeStep ? "#165283" : "#5A6B7A",
                      }}
                    >
                      {s.label}
                    </Typography>
                  </Box>
                ))}
              </Box>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, x: direction * 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -50 }}
                  transition={{ duration: 0.3 }}
                >
                  <form onSubmit={handleSubmit}>
                    {/* STEP 0: Room & Date Selection */}
                    {activeStep === 0 && (
                      <Grid container spacing={4}>
                        <Grid item xs={12} md={6}>
                          <Paper
                            sx={{ p: 3, bgcolor: "#F8FAFC", borderRadius: 3 }}
                          >
                            <Typography
                              variant="h6"
                              fontWeight={600}
                              mb={3}
                              sx={{
                                color: "#165283",
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <MeetingRoomIcon /> Select Room & Date
                            </Typography>
                            <TextField
                              type="date"
                              label="Select Date"
                              value={form.date}
                              onChange={(e) => setField("date")(e.target.value)}
                              fullWidth
                              InputLabelProps={{ shrink: true }}
                              inputProps={{
                                min: new Date().toISOString().split("T")[0],
                              }}
                              sx={{ mb: 3 }}
                            />
                            <Button
                              variant="contained"
                              startIcon={<MeetingRoomIcon />}
                              onClick={() => setRoomModalOpen(true)}
                              fullWidth
                              sx={{ mb: 2, bgcolor: "#165283", py: 1.5 }}
                            >
                              Choose Room
                            </Button>
                            {form.room && (
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1,
                                  mb: 3,
                                }}
                              >
                                <Chip
                                  icon={<MeetingRoomIcon />}
                                  label={form.room}
                                  onDelete={() => setField("room")("")}
                                  sx={{
                                    bgcolor: "#E8F0F7",
                                    color: "#165283",
                                    fontWeight: 500,
                                  }}
                                />
                              </Box>
                            )}
                            <Button
                              variant="outlined"
                              fullWidth
                              startIcon={<AccessTimeIcon />}
                              onClick={handleRoomDateSelected}
                              disabled={!form.date || !form.room}
                              sx={{
                                borderColor: "#165283",
                                color: "#165283",
                                "&:hover": {
                                  borderColor: "#0E3D61",
                                  bgcolor: "#E8F0F7",
                                },
                                py: 1.5,
                              }}
                            >
                              Set Schedule
                            </Button>
                          </Paper>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          {form.room &&
                          form.date &&
                          form.startTime &&
                          form.endTime ? (
                            <Paper
                              sx={{ p: 3, bgcolor: "#F8FAFC", borderRadius: 3 }}
                            >
                              <Typography
                                variant="h6"
                                fontWeight={600}
                                mb={2}
                                sx={{
                                  color: "#165283",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1,
                                }}
                              >
                                <TodayIcon /> Selected Schedule
                              </Typography>
                              <Box
                                sx={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 1.5,
                                }}
                              >
                                <Box>
                                  <Typography
                                    variant="caption"
                                    sx={{ color: "#5A6B7A" }}
                                  >
                                    Room
                                  </Typography>
                                  <Typography fontWeight={500}>
                                    {form.room}
                                  </Typography>
                                </Box>
                                <Box>
                                  <Typography
                                    variant="caption"
                                    sx={{ color: "#5A6B7A" }}
                                  >
                                    Date
                                  </Typography>
                                  <Typography fontWeight={500}>
                                    {form.date}
                                  </Typography>
                                </Box>
                                <Box>
                                  <Typography
                                    variant="caption"
                                    sx={{ color: "#5A6B7A" }}
                                  >
                                    Time
                                  </Typography>
                                  <Typography fontWeight={500}>
                                    {form.startTime} - {form.endTime}
                                  </Typography>
                                </Box>
                                <Box>
                                  <Typography
                                    variant="caption"
                                    sx={{ color: "#5A6B7A" }}
                                  >
                                    Duration
                                  </Typography>
                                  <Typography fontWeight={500}>
                                    {calculateDuration(
                                      form.startTime,
                                      form.endTime,
                                    )}
                                  </Typography>
                                </Box>
                                {recurrence.type !== "none" && (
                                  <Chip
                                    label={`${recurrence.type} until ${recurrence.endDate}`}
                                    size="small"
                                    sx={{
                                      mt: 1,
                                      bgcolor: "#E8F0F7",
                                      color: "#165283",
                                    }}
                                  />
                                )}
                                {conflict && (
                                  <Alert
                                    severity="warning"
                                    sx={{ mt: 2, borderRadius: 2 }}
                                  >
                                    {conflict}
                                  </Alert>
                                )}
                                {!conflict &&
                                  form.startTime &&
                                  form.endTime && (
                                    <Alert
                                      severity="success"
                                      sx={{
                                        mt: 2,
                                        borderRadius: 2,
                                        bgcolor: "#E8F5E9",
                                        color: "#2E7D32",
                                      }}
                                    >
                                      ✓ No conflicts detected
                                    </Alert>
                                  )}
                                <Button
                                  size="small"
                                  sx={{
                                    mt: 1,
                                    color: "#165283",
                                    alignSelf: "flex-start",
                                  }}
                                  onClick={() => setScheduleModalOpen(true)}
                                >
                                  Edit Schedule
                                </Button>
                              </Box>
                            </Paper>
                          ) : (
                            <Paper
                              sx={{
                                p: 4,
                                textAlign: "center",
                                bgcolor: "#F8FAFC",
                                borderRadius: 3,
                                height: "100%",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center",
                                alignItems: "center",
                              }}
                            >
                              <AccessTimeIcon
                                sx={{ fontSize: 48, color: "#C0C8D0", mb: 2 }}
                              />
                              <Typography color="#5A6B7A">
                                {!form.date
                                  ? "Select a date to begin"
                                  : !form.room
                                    ? "Choose a meeting room"
                                    : "Click 'Set Schedule' to select time"}
                              </Typography>
                            </Paper>
                          )}
                        </Grid>
                      </Grid>
                    )}

                    {/* STEP 1: Meeting Details */}
                    {activeStep === 1 && (
                      <Grid container spacing={3}>
                        <Grid item xs={12}>
                          <Typography
                            variant="h6"
                            fontWeight={600}
                            mb={3}
                            sx={{
                              color: "#165283",
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <DescriptionIcon /> Meeting Details
                          </Typography>
                        </Grid>

                        <Grid item xs={12}>
                          <Grid container spacing={3}>
                            <Grid item xs={12} md={4}>
                              <TextField
                                label="Employee ID"
                                value={form.employeeId}
                                placeholder="AP0000"
                                onChange={(e) => {
                                  let v = e.target.value.toUpperCase();
                                  if (v.startsWith("AP")) v = v.slice(0, 6);
                                  setField("employeeId")(v);
                                }}
                                fullWidth
                                InputProps={{
                                  startAdornment: (
                                    <InputAdornment position="start">
                                      <BadgeIcon sx={{ color: "#165283" }} />
                                    </InputAdornment>
                                  ),
                                }}
                                helperText="Format: AP followed by 4 digits"
                              />
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <TextField
                                label="Employee Name"
                                value={form.empName}
                                fullWidth
                                InputProps={{
                                  readOnly: true,
                                  startAdornment: (
                                    <InputAdornment position="start">
                                      <PersonIcon sx={{ color: "#165283" }} />
                                    </InputAdornment>
                                  ),
                                }}
                              />
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <Typography
                                variant="subtitle2"
                                mb={1}
                                sx={{ color: "#165283", fontWeight: 500 }}
                              >
                                Organizer Email *
                              </Typography>
                              <CreatableSelect
                                value={
                                  form.email
                                    ? { value: form.email, label: form.email }
                                    : null
                                }
                                onChange={(v) =>
                                  setField("email")(v?.value || "")
                                }
                                onCreateOption={(value) =>
                                  setField("email")(value)
                                }
                                options={emailOptions}
                                isLoading={emailLoading}
                                onInputChange={searchEmails}
                                isClearable
                                styles={{
                                  control: (base) => ({
                                    ...base,
                                    borderRadius: 10,
                                    borderColor: "#E0E6ED",
                                    "&:hover": { borderColor: "#165283" },
                                    minHeight: 56,
                                    backgroundColor: "#F5F5F5",
                                  }),
                                  option: (base, { isFocused }) => ({
                                    ...base,
                                    backgroundColor: isFocused
                                      ? "#E8F0F7"
                                      : "white",
                                    color: "#165283",
                                  }),
                                  placeholder: (base) => ({
                                    ...base,
                                    color: "#9E9E9E",
                                  }),
                                }}
                                placeholder="Enter or select organizer email"
                              />
                            </Grid>
                          </Grid>
                        </Grid>

                        <Grid item xs={12}>
                          <Typography
                            variant="subtitle2"
                            mb={1}
                            sx={{ color: "#165283", fontWeight: 500 }}
                          >
                            CC (Optional)
                          </Typography>
                          <CreatableSelect
                            isMulti
                            value={form.cc.map((c) => ({ value: c, label: c }))}
                            onChange={(v) =>
                              setField("cc")(v ? v.map((o) => o.value) : [])
                            }
                            options={emailOptions}
                            isLoading={emailLoading}
                            onInputChange={searchEmails}
                            styles={{
                              control: (base) => ({
                                ...base,
                                borderRadius: 10,
                                borderColor: "#E0E6ED",
                                "&:hover": { borderColor: "#165283" },
                                minHeight: 56,
                              }),
                              multiValue: (base) => ({
                                ...base,
                                backgroundColor: "#E8F0F7",
                              }),
                              multiValueLabel: (base) => ({
                                ...base,
                                color: "#165283",
                              }),
                              placeholder: (base) => ({
                                ...base,
                                color: "#9E9E9E",
                              }),
                            }}
                            placeholder="Type email and press enter to add"
                          />
                        </Grid>

                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            label="Meeting Agenda"
                            value={form.ma}
                            onChange={(e) => setField("ma")(e.target.value)}
                            multiline
                            rows={4}
                            placeholder="Describe the purpose and key discussion points of this meeting..."
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <DescriptionIcon sx={{ color: "#165283" }} />
                                </InputAdornment>
                              ),
                            }}
                          />
                        </Grid>
                      </Grid>
                    )}
                    
                    {/* STEP 2: Review */}
                    {activeStep === 2 && (
                      <Paper sx={{ p: 4, bgcolor: "#F8FAFC", borderRadius: 3 }}>
                        <Typography
                          variant="h6"
                          fontWeight={600}
                          mb={3}
                          sx={{
                            color: "#165283",
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                          }}
                        >
                          <CheckCircleIcon /> Review Your Booking
                        </Typography>
                        <Grid container spacing={3}>
                          <Grid item xs={12} md={6}>
                            <Box
                              sx={{ bgcolor: "white", p: 2, borderRadius: 2 }}
                            >
                              <Typography
                                variant="caption"
                                sx={{
                                  color: "#5A6B7A",
                                  display: "block",
                                  mb: 0.5,
                                }}
                              >
                                Room
                              </Typography>
                              <Typography
                                fontWeight={600}
                                sx={{ color: "#165283" }}
                              >
                                {form.room || "—"}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <Box
                              sx={{ bgcolor: "white", p: 2, borderRadius: 2 }}
                            >
                              <Typography
                                variant="caption"
                                sx={{
                                  color: "#5A6B7A",
                                  display: "block",
                                  mb: 0.5,
                                }}
                              >
                                Date
                              </Typography>
                              <Typography
                                fontWeight={600}
                                sx={{ color: "#165283" }}
                              >
                                {form.date || "—"}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <Box
                              sx={{ bgcolor: "white", p: 2, borderRadius: 2 }}
                            >
                              <Typography
                                variant="caption"
                                sx={{
                                  color: "#5A6B7A",
                                  display: "block",
                                  mb: 0.5,
                                }}
                              >
                                Time
                              </Typography>
                              <Typography
                                fontWeight={600}
                                sx={{ color: "#165283" }}
                              >
                                {form.startTime && form.endTime
                                  ? `${form.startTime} - ${form.endTime}`
                                  : "—"}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <Box
                              sx={{ bgcolor: "white", p: 2, borderRadius: 2 }}
                            >
                              <Typography
                                variant="caption"
                                sx={{
                                  color: "#5A6B7A",
                                  display: "block",
                                  mb: 0.5,
                                }}
                              >
                                Duration
                              </Typography>
                              <Typography
                                fontWeight={600}
                                sx={{ color: "#165283" }}
                              >
                                {calculateDuration(
                                  form.startTime,
                                  form.endTime,
                                )}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <Box
                              sx={{ bgcolor: "white", p: 2, borderRadius: 2 }}
                            >
                              <Typography
                                variant="caption"
                                sx={{
                                  color: "#5A6B7A",
                                  display: "block",
                                  mb: 0.5,
                                }}
                              >
                                Organizer
                              </Typography>
                              <Typography
                                fontWeight={600}
                                sx={{ color: "#165283" }}
                              >
                                {form.empName || "—"} ({form.employeeId})
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <Box
                              sx={{ bgcolor: "white", p: 2, borderRadius: 2 }}
                            >
                              <Typography
                                variant="caption"
                                sx={{
                                  color: "#5A6B7A",
                                  display: "block",
                                  mb: 0.5,
                                }}
                              >
                                Email
                              </Typography>
                              <Typography
                                fontWeight={600}
                                sx={{ color: "#165283" }}
                              >
                                {form.email || "—"}
                              </Typography>
                            </Box>
                          </Grid>
                          {form.cc.length > 0 && (
                            <Grid item xs={12}>
                              <Box
                                sx={{ bgcolor: "white", p: 2, borderRadius: 2 }}
                              >
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: "#5A6B7A",
                                    display: "block",
                                    mb: 0.5,
                                  }}
                                >
                                  CC
                                </Typography>
                                <Typography
                                  fontWeight={600}
                                  sx={{ color: "#165283" }}
                                >
                                  {form.cc.join(", ")}
                                </Typography>
                              </Box>
                            </Grid>
                          )}
                          {recurrence.type !== "none" && (
                            <Grid item xs={12}>
                              <Box
                                sx={{ bgcolor: "white", p: 2, borderRadius: 2 }}
                              >
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: "#5A6B7A",
                                    display: "block",
                                    mb: 0.5,
                                  }}
                                >
                                  Recurrence
                                </Typography>
                                <Typography
                                  fontWeight={600}
                                  sx={{ color: "#165283" }}
                                >
                                  {recurrence.type} until {recurrence.endDate}
                                </Typography>
                              </Box>
                            </Grid>
                          )}
                          {form.ma && (
                            <Grid item xs={12}>
                              <Box
                                sx={{ bgcolor: "white", p: 2, borderRadius: 2 }}
                              >
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: "#5A6B7A",
                                    display: "block",
                                    mb: 0.5,
                                  }}
                                >
                                  Agenda
                                </Typography>
                                <Typography
                                  sx={{
                                    color: "#165283",
                                    whiteSpace: "pre-wrap",
                                  }}
                                >
                                  {form.ma}
                                </Typography>
                              </Box>
                            </Grid>
                          )}
                        </Grid>
                      </Paper>
                    )}

                    {error && (
                      <Alert
                        severity="error"
                        sx={{ mt: 3, borderRadius: 2 }}
                        onClose={() => setError("")}
                      >
                        {error}
                      </Alert>
                    )}

                    {/* Navigation Buttons */}
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        mt: 4,
                        pt: 3,
                        borderTop: "1px solid #E8ECF0",
                      }}
                    >
                      <Button
                        variant="outlined"
                        onClick={handleBack}
                        disabled={activeStep === 0 || submitting}
                        startIcon={<ArrowBackIcon />}
                        sx={{ borderColor: "#C0C8D0", color: "#165283" }}
                      >
                        Back
                      </Button>
                      <Box sx={{ display: "flex", gap: 2 }}>
                        <Button
                          variant="outlined"
                          onClick={() => {
                            const bookedBy = getBookedBy();
                            setForm({
                              empName: "",
                              employeeId: "",
                              date: "",
                              startTime: "",
                              endTime: "",
                              email: "",
                              room: "",
                              ma: "",
                              bookedBy: bookedBy,
                              cc: [],
                            });
                            setActiveStep(0);
                          }}
                          startIcon={<RefreshIcon />}
                          sx={{ borderColor: "#C0C8D0", color: "#165283" }}
                        >
                          Reset
                        </Button>
                        {activeStep === 2 ? (
                          <Button
                            type="submit"
                            variant="contained"
                            disabled={submitting || progress < 100}
                            startIcon={
                              submitting ? (
                                <CircularProgress
                                  size={20}
                                  sx={{ color: "white" }}
                                />
                              ) : (
                                <SendIcon />
                              )
                            }
                            sx={{
                              bgcolor: "#165283",
                              "&:hover": { bgcolor: "#0E3D61" },
                              px: 4,
                            }}
                          >
                            {submitting ? "Submitting..." : "Submit Booking"}
                          </Button>
                        ) : (
                          <Button
                            variant="contained"
                            onClick={handleNext}
                            endIcon={<ArrowForwardIcon />}
                            sx={{
                              bgcolor: "#165283",
                              "&:hover": { bgcolor: "#0E3D61" },
                              px: 4,
                            }}
                          >
                            Next
                          </Button>
                        )}
                      </Box>
                    </Box>
                  </form>
                </motion.div>
              </AnimatePresence>
            </Paper>
          </motion.div>
        </Container>
      </Box>

      {/* Modals */}
      <ScheduleModal />
      <RoomSelectionModal
        open={roomModalOpen}
        onClose={() => setRoomModalOpen(false)}
        onSelectRoom={(r) => {
          setField("room")(r);
          setRoomModalOpen(false);
        }}
        selectedRoom={form.room}
        date={form.date}
        existingBookings={bookings}
      />
    </ThemeProvider>
  );
};

export default BookingForm;