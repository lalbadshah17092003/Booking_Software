import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import "./BookingForm.css";
import CreatableSelect from "react-select/creatable";
import { jwtDecode } from "jwt-decode";
import debounce from "lodash/debounce";
import {
  Box,
  Typography,
  TextField,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  InputAdornment,
  Skeleton,
  Container,
  Paper,
  Grid,
  Drawer,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Rating,
  useMediaQuery,
} from "@mui/material";
import {
  Person as PersonIcon,
  Description as DescriptionIcon,
  Refresh as RefreshIcon,
  Send as SendIcon,
  MeetingRoom as MeetingRoomIcon,
  Badge as BadgeIcon,
  CheckCircle as CheckCircleIcon,
  People as PeopleIcon,
  LocationOn as LocationOnIcon,
  Close as CloseIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  AccessTime as AccessTimeIcon,
  Star as StarIcon,
} from "@mui/icons-material";
import { ThemeProvider, createTheme } from "@mui/material/styles";

// ============================================
// SUPPLEMENTARY ROOM MEDIA  — image assets already in the project
// (originating from RoomSelectionModal / MyMeeting).
// Keyed by room name; used only as fallback when API omits a field.
// ============================================
const ROOM_MEDIA = {
  "Admin Conference Room": {
    image: require("../styles/AUM_0334.webp"),
    floor: "Admin 1st Floor",
    building: "Main Building",
    amenities: ["Video Conference"],
    description:
      "Premium conference room with video conferencing — ideal for leadership and cross-team meetings.",
    rating: 4.8,
    reviews: 24,
    size: "Large",
    capacity: "35+",
  },
  "QA Conference Room": {
    image: require("../styles/QA_conference.webp"),
    floor: "Admin 4th Floor",
    building: "Main Building",
    amenities: ["Video Conference"],
    description:
      "Comfortable mid-size conference room suited for QA reviews and collaborative sessions.",
    rating: 4.5,
    reviews: 18,
    size: "Medium",
    capacity: "25+",
  },
  "QA Training Room": {
    image: require("../styles/QA_Training.webp"),
    floor: "Admin 4th Floor",
    building: "Training Wing",
    amenities: ["Projector", "Whiteboard"],
    description:
      "Spacious training room with projector and whiteboard, designed for workshops and onboarding.",
    rating: 4.6,
    reviews: 15,
    size: "Large",
    capacity: "50+",
  },
  "Meeting Room 1": {
    image: require("../styles/training.webp"),
    floor: "Admin Reception Area",
    building: "Main Building",
    amenities: ["Laptop", "WiFi"],
    description:
      "Compact meeting room for quick 1-on-1s and stand-ups.",
    rating: 4.3,
    reviews: 12,
    size: "Small",
    capacity: "5+",
  },
  "Meeting Room 2": {
    image: require("../styles/training.webp"),
    floor: "Admin Reception Area",
    building: "Main Building",
    amenities: ["Laptop", "WiFi"],
    description:
      "Mid-size meeting room for team discussions and reviews.",
    rating: 4.4,
    reviews: 10,
    size: "Medium",
    capacity: "5+",
  },
};

const getRoomMedia = (room) => {
  const name =
    typeof room === "string" ? room : room?.name || room?.roomName || "";
  return ROOM_MEDIA[name] || null;
};

// ============================================
// API & UTILS
// ============================================
const API_BASE = process.env.REACT_APP_API_URL || "https://192.168.0.150:5000/api";
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
const normText = (v) => String(v || "").trim().toLowerCase();
const overlap = (s1, e1, s2, e2) => s1 < e2 && e1 > s2;
const sameRoom = (a, b) => normText(a) === normText(b);
const sameDate = (a, b) => normDate(a) === normDate(b);
const blockingStatus = (s) =>
  ["pending", "approved", "ongoing", "completed"].includes(normText(s));

const getRoomName = (r) =>
  typeof r === "string" ? r : r?.name || r?.roomName || "";
const getRoomId = (r) =>
  typeof r === "string" ? r : r?._id || r?.id || "";

const getRoomCapacity = (r) => {
  if (typeof r === "object" && r !== null) {
    const n = Number(r.capacity ?? r.seats ?? r.seatingCapacity);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const m = getRoomMedia(r);
  if (m?.capacity) {
    const n = parseInt(String(m.capacity).replace(/[^\d]/g, ""), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
};

const getRoomFacilities = (r) => {
  if (typeof r === "object" && r !== null) {
    const raw = r.facilities ?? r.amenities ?? r.features;
    if (Array.isArray(raw)) {
      const arr = raw
        .map((f) => (typeof f === "string" ? f : f?.name))
        .filter(Boolean);
      if (arr.length) return arr;
    }
    if (typeof raw === "string") {
      const arr = raw.split(",").map((s) => s.trim()).filter(Boolean);
      if (arr.length) return arr;
    }
  }
  return getRoomMedia(r)?.amenities || [];
};

const getRoomLocation = (r) => {
  if (typeof r === "object" && r !== null) {
    const loc = [r.building, r.block, r.floor, r.location]
      .filter(Boolean)
      .join(" · ");
    if (loc) return loc;
  }
  const m = getRoomMedia(r);
  if (!m) return "";
  return [m.building, m.floor].filter(Boolean).join(" · ");
};

const getRoomImage = (r) => {
  if (typeof r === "object" && r !== null) {
    const img =
      r.image || r.imageUrl || r.photo || r.thumbnail || r.img || "";
    if (img) return img;
  }
  return getRoomMedia(r)?.image || "";
};

const getRoomDescription = (r) => {
  if (typeof r === "object" && r !== null && r.description)
    return r.description;
  return getRoomMedia(r)?.description || "";
};

const getRoomRating = (r) => {
  if (typeof r === "object" && r !== null && (r.rating || r.stars)) {
    return {
      rating: Number(r.rating ?? r.stars) || 0,
      reviews: Number(r.reviews) || 0,
    };
  }
  const m = getRoomMedia(r);
  if (m?.rating) return { rating: m.rating, reviews: m.reviews || 0 };
  return null;
};

const defaultRooms = [
  { _id: "admin", name: "Admin Conference Room", capacity: 35 },
  { _id: "qa-conf", name: "QA Conference Room", capacity: 25 },
  { _id: "qa-train", name: "QA Training Room", capacity: 50 },
];

const debouncedEmailSearch = debounce(async (query, setter, loader) => {
  if (!query || query.length === 0) return;
  loader(true);
  try {
    const { data } = await api.get("/email-entry/list", {
      params: { search: query, limit: 50 },
    });
    setter(
      (data.data || data || []).map((e) => ({
        value: e.emailId,
        label: `${e.firstName || ""} ${e.lastName || ""} <${e.emailId}>`.trim(),
      })),
    );
  } catch (e) {
    console.error("Email search error:", e);
  }
  loader(false);
}, 500);

// ============================================
// TOKENS
// ============================================
const T = {
  primary: "#087E8B",
  primaryHover: "#066873",
  primaryTint: "#E6F4F5",
  primarySoft: "#F0FBFA",
  navy: "#12304A",
  bg: "#F7F9FC",
  card: "#FFFFFF",
  text: "#334155",
  textSecondary: "#64748B",
  border: "#E2E8F0",
  success: "#15803D",
  successBg: "#DCFCE7",
  successBorder: "#BBF7D0",
  warning: "#B45309",
  error: "#B91C1C",
  errorBg: "#FEE2E2",
  errorBorder: "#FECACA",
  neutralBg: "#F1F5F9",
};

const formatDateDisplay = (d) => {
  if (!d) return "";
  try {
    const x = new Date(`${d}T00:00:00`);
    if (isNaN(x.getTime())) return d;
    return x.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
};

const calculateDuration = (s, e) => {
  if (!s || !e) return "0h 0m";
  const diff = new Date(`2000-01-01T${e}`) - new Date(`2000-01-01T${s}`);
  if (diff <= 0) return "0h 0m";
  return `${Math.floor(diff / 3600000)}h ${Math.floor(
    (diff % 3600000) / 60000,
  )}m`;
};

// ============================================
// SHARED SMALL COMPONENTS
// ============================================
const AvailabilityBadge = ({ status, checking }) => {
  if (checking) {
    return (
      <Box
        component="span"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.75,
          bgcolor: T.neutralBg,
          color: T.textSecondary,
          border: `1px solid ${T.border}`,
          borderRadius: 999,
          px: 1,
          py: 0.25,
          fontSize: "0.72rem",
          fontWeight: 600,
        }}
      >
        <CircularProgress size={10} sx={{ color: T.textSecondary }} />
        Confirming…
      </Box>
    );
  }
  const map = {
    available: {
      bg: T.successBg,
      color: T.success,
      border: T.successBorder,
      dot: T.success,
      label: "Available",
    },
    occupied: {
      bg: T.errorBg,
      color: T.error,
      border: T.errorBorder,
      dot: T.error,
      label: "Occupied",
    },
    unknown: {
      bg: T.neutralBg,
      color: T.textSecondary,
      border: T.border,
      dot: "#94A3B8",
      label: "Unknown",
    },
  };
  const c = map[status] || map.unknown;
  return (
    <Box
      component="span"
      aria-label={`Availability: ${c.label}`}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        bgcolor: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
        borderRadius: 999,
        px: 0.9,
        py: 0.2,
        fontSize: "0.72rem",
        fontWeight: 600,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
      }}
    >
      <Box
        component="span"
        sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: c.dot }}
      />
      {c.label}
    </Box>
  );
};

const FacilPill = ({ label }) => (
  <Box
    component="span"
    sx={{
      bgcolor: T.neutralBg,
      color: T.text,
      border: `1px solid ${T.border}`,
      borderRadius: 1,
      px: 0.7,
      py: 0.1,
      fontSize: "0.68rem",
      fontWeight: 500,
      lineHeight: 1.5,
    }}
  >
    {label}
  </Box>
);

// ---------- IMAGE CARD (used in wheel modal gallery) ----------
const RoomGalleryCard = ({ room, selected, availability, disabled, onSelect }) => {
  const [imageError, setImageError] = useState(false);
  const name = getRoomName(room);
  const capacity = getRoomCapacity(room);
  const location = getRoomLocation(room);
  const imageUrl = getRoomImage(room);
  const facilities = getRoomFacilities(room);
  const showImage = !!imageUrl && !imageError;
  const rating = getRoomRating(room);

  const onKey = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!disabled) onSelect();
    }
  };

  return (
    <Box
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={selected}
      aria-disabled={disabled}
      aria-label={`${name}${capacity ? `, ${capacity} seats` : ""}${
        location ? `, ${location}` : ""
      }. ${availability === "available" ? "Available" : availability === "occupied" ? "Occupied" : "Availability unknown"}.${selected ? " Selected." : ""}`}
      onClick={() => !disabled && onSelect()}
      onKeyDown={onKey}
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        bgcolor: selected ? T.primarySoft : T.card,
        border: `${selected ? 2 : 1}px solid ${
          selected ? T.primary : T.border
        }`,
        borderRadius: 2.5,
        overflow: "hidden",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        boxShadow: selected ? "0 4px 16px rgba(8,126,139,0.12)" : "none",
        transition: "border-color 120ms ease, box-shadow 120ms ease",
        "&:hover": disabled
          ? {}
          : {
              borderColor: T.primary,
              boxShadow: "0 6px 20px rgba(15,23,42,0.08)",
            },
        "&:focus-visible": {
          outline: `2px solid ${T.primary}`,
          outlineOffset: 2,
        },
        "@media (prefers-reduced-motion: reduce)": { transition: "none" },
      }}
    >
      <Box
        sx={{
          position: "relative",
          width: "100%",
          aspectRatio: "16 / 9",
          bgcolor: T.primaryTint,
          overflow: "hidden",
        }}
      >
        {showImage ? (
          <Box
            component="img"
            src={imageUrl}
            alt={`${name} room`}
            onError={() => setImageError(true)}
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: T.primary,
            }}
          >
            <MeetingRoomIcon sx={{ fontSize: 40, opacity: 0.9 }} />
          </Box>
        )}
        {selected && (
          <Box
            sx={{
              position: "absolute",
              top: 8,
              left: 8,
              display: "inline-flex",
              alignItems: "center",
              gap: 0.4,
              bgcolor: T.primary,
              color: "#fff",
              borderRadius: 999,
              px: 0.9,
              py: 0.2,
              fontSize: "0.68rem",
              fontWeight: 700,
            }}
          >
            <CheckCircleIcon sx={{ fontSize: 12 }} /> Selected
          </Box>
        )}
        <Box
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
          }}
        >
          <AvailabilityBadge status={availability} />
        </Box>
        {capacity && (
          <Box
            sx={{
              position: "absolute",
              bottom: 8,
              right: 8,
              display: "inline-flex",
              alignItems: "center",
              gap: 0.3,
              bgcolor: "rgba(255,255,255,0.94)",
              color: T.navy,
              borderRadius: 999,
              px: 0.9,
              py: 0.2,
              fontSize: "0.7rem",
              fontWeight: 700,
            }}
          >
            <PeopleIcon sx={{ fontSize: 12 }} /> {capacity}
          </Box>
        )}
      </Box>

      <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 0.5 }}>
        <Typography
          sx={{
            color: T.navy,
            fontWeight: 700,
            fontSize: "0.92rem",
            lineHeight: 1.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={name}
        >
          {name}
        </Typography>
        {location && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
            <LocationOnIcon sx={{ fontSize: 12, color: T.textSecondary }} />
            <Typography
              sx={{
                fontSize: "0.72rem",
                color: T.textSecondary,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {location}
            </Typography>
          </Box>
        )}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          {rating && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
              <StarIcon sx={{ fontSize: 13, color: "#F59E0B" }} />
              <Typography
                sx={{ fontSize: "0.72rem", fontWeight: 600, color: T.navy }}
              >
                {rating.rating.toFixed(1)}
              </Typography>
              {rating.reviews > 0 && (
                <Typography
                  sx={{ fontSize: "0.68rem", color: T.textSecondary }}
                >
                  ({rating.reviews})
                </Typography>
              )}
            </Box>
          )}
          {facilities.length > 0 && (
            <Typography
              sx={{
                fontSize: "0.7rem",
                color: T.textSecondary,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {facilities.slice(0, 2).join(" · ")}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};

// ============================================
// CIRCULAR ROOM WHEEL
// ============================================
const polarToCartesian = (cx, cy, r, angleDeg) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const buildSlicePath = (cx, cy, innerR, outerR, startAngle, endAngle) => {
  const outerStart = polarToCartesian(cx, cy, outerR, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
    `L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
    "Z",
  ].join(" ");
};

const RoomWheel = ({ rooms, selectedName, onSelect }) => {
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 6;
  const innerR = 68;
  const n = rooms.length;
  const shades = [
    "#087E8B",
    "#0E9AA7",
    "#0A8895",
    "#0E8F9C",
    "#0B828F",
    "#128A96",
    "#0D7F8C",
    "#0F94A1",
  ];

  if (n < 3 || n > 8) return null;

  const anglePer = 360 / n;

  return (
    <Box sx={{ width: "100%", maxWidth: size, mx: "auto" }}>
      <Box
        component="svg"
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        role="group"
        aria-label="Circular room selector"
        sx={{ display: "block" }}
      >
        {rooms.map((room, i) => {
          const name = getRoomName(room);
          const startAngle = i * anglePer;
          const endAngle = (i + 1) * anglePer;
          const midAngle = (startAngle + endAngle) / 2;
          const isSelected = sameRoom(name, selectedName);
          const labelPos = polarToCartesian(
            cx,
            cy,
            (innerR + outerR) / 2,
            midAngle,
          );
          const truncated =
            name.length > 14 ? `${name.slice(0, 13)}…` : name;

          return (
            <g
              key={getRoomId(room) || name}
              role="button"
              tabIndex={0}
              aria-label={`Select ${name}`}
              aria-pressed={isSelected}
              onClick={() => onSelect(name)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(name);
                }
              }}
              style={{ cursor: "pointer", outline: "none" }}
            >
              <path
                d={buildSlicePath(
                  cx,
                  cy,
                  innerR,
                  outerR,
                  startAngle,
                  endAngle,
                )}
                fill={
                  isSelected
                    ? T.primaryHover
                    : shades[i % shades.length]
                }
                stroke="#fff"
                strokeWidth={2}
                style={{ transition: "fill 150ms ease" }}
              />
              <text
                x={labelPos.x}
                y={labelPos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#fff"
                fontSize="11"
                fontWeight={600}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {truncated}
              </text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={innerR - 4} fill="#066873" />
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          fill="#fff"
          fontSize="11"
          fontWeight={700}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          Choose
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          fill="#fff"
          fontSize="11"
          fontWeight={700}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          a room
        </text>
      </Box>
    </Box>
  );
};

// ============================================
// THEME
// ============================================
const theme = createTheme({
  palette: {
    primary: { main: T.primary },
    secondary: { main: "#0E9AA7" },
    success: { main: T.success },
    error: { main: T.error },
    warning: { main: T.warning },
    background: { default: T.bg, paper: T.card },
    text: { primary: T.text, secondary: T.textSecondary },
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", "Roboto", sans-serif',
    h5: { fontWeight: 700, color: T.navy },
    button: { textTransform: "none", fontWeight: 600 },
    body1: { color: T.text },
    body2: { color: T.textSecondary },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10, padding: "10px 20px" },
        contained: {
          boxShadow: "none",
          "&:hover": { boxShadow: "0 4px 12px rgba(8,126,139,0.2)" },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 10,
            "& fieldset": { borderColor: T.border },
            "&:hover fieldset": { borderColor: T.primary },
            "&.Mui-focused fieldset": { borderColor: T.primary },
          },
        },
      },
    },
  },
});

// ============================================
// MAIN COMPONENT
// ============================================
const BookingForm = () => {
  const isMobile = useMediaQuery("(max-width:899.95px)");

  const [activeStep, setActiveStep] = useState(0);
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerImageError, setDrawerImageError] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [bookingsLoadedFor, setBookingsLoadedFor] = useState("");
  const [recurrence, setRecurrence] = useState({ type: "none", endDate: "" });
  const [emailOptions, setEmailOptions] = useState([]);
  const [emailLoading, setEmailLoading] = useState(false);
  const [allEmployees, setAllEmployees] = useState([]);
  const [currentUser, setCurrentUser] = useState({ name: "", role: "" });

  const setField = (field) => (value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // PRESERVED: JWT bookedBy
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

  // PRESERVED: selectedBookings for drawer display
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

  // PRESERVED: progress formula
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

  // PRESERVED: fetchBookings — endpoint, limit 200, date, status
  const fetchBookings = useCallback(async () => {
    if (!form.date) {
      setBookings([]);
      setBookingsLoadedFor("");
      return;
    }
    setCheckingConflicts(true);
    try {
      const { data } = await api.get("/booking", {
        params: {
          limit: 200,
          date: form.date,
          status: "pending,approved,ongoing,completed",
        },
      });
      setBookings(getArray(data, ["bookings"]));
      setBookingsLoadedFor(form.date);
    } catch (e) {
      console.error(e);
      setBookings([]);
      setBookingsLoadedFor("");
    } finally {
      setCheckingConflicts(false);
    }
  }, [form.date]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [{ data: r }, { data: emp }] = await Promise.all([
          api.get("/rooms", { params: { limit: 50 } }),
          api.get("/employees"),
        ]);
        setRooms(
          getArray(r, ["rooms"]).length
            ? getArray(r, ["rooms"])
            : defaultRooms,
        );
        setAllEmployees(emp.data || emp || []);

        const token = sessionStorage.getItem("token");
        if (token) {
          try {
            const decoded = jwtDecode(token);
            const employeeId = decoded.employeeId || decoded.sub || "";
            setForm((prev) => ({ ...prev, bookedBy: employeeId }));
            setCurrentUser({
              name:
                decoded.name ||
                decoded.employeeName ||
                decoded.employeeId ||
                "",
              role: decoded.role || sessionStorage.getItem("role") || "",
            });
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
            label: `${e.firstName || ""} ${e.lastName || ""} <${e.emailId}>`.trim(),
          })),
        );
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // PRESERVED: roomAvailability with gate
  const roomAvailability = useMemo(() => {
    const map = {};
    const dateReady = !!form.date && bookingsLoadedFor === form.date;
    const hasTime = !!(form.startTime && form.endTime);
    rooms.forEach((room) => {
      const name = getRoomName(room);
      if (!name) return;
      if (!dateReady || !hasTime) {
        map[name] = "unknown";
        return;
      }
      const conflicting = bookings.filter(
        (b) =>
          sameRoom(b.room, name) &&
          sameDate(b.date, form.date) &&
          blockingStatus(b.status) &&
          overlap(b.startTime, b.endTime, form.startTime, form.endTime),
      );
      map[name] = conflicting.length ? "occupied" : "available";
    });
    return map;
  }, [
    rooms,
    bookings,
    form.date,
    form.startTime,
    form.endTime,
    bookingsLoadedFor,
  ]);

  // PRESERVED: conflict derivation
  useEffect(() => {
    if (!form.room || !form.date || !form.startTime || !form.endTime) {
      setConflict("");
      return;
    }
    const conflicts = bookings.filter(
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
  }, [bookings, form.room, form.date, form.startTime, form.endTime]);

  // PRESERVED: employee autofill
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

  // PRESERVED: debounced email search
  const searchEmails = useCallback((inputValue) => {
    debouncedEmailSearch(inputValue, setEmailOptions, setEmailLoading);
  }, []);

  // PRESERVED: handleNext
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
    setActiveStep((p) => Math.min(p + 1, 2));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // PRESERVED: handleBack
  const handleBack = () => {
    setError("");
    setActiveStep((p) => Math.max(p - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // PRESERVED: handleSubmit (identical payload)
  const handleSubmit = async (e) => {
    e.preventDefault();
    const bookedBy = getBookedBy();

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
        bookedBy,
        cc: form.cc.join(", "),
        ...recurrence,
      };

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
          bookedBy,
          cc: [],
        });
        setActiveStep(0);
      }, 3000);
    } catch (err) {
      console.error("Submission error:", err);
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Submission failed",
      );
    }
    setSubmitting(false);
  };

  const handleReset = () => {
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
      bookedBy,
      cc: [],
    });
    setError("");
    setActiveStep(0);
  };

  const handleSelectRoom = (name) => {
    setField("room")(name);
    setRoomModalOpen(false);
    setDrawerOpen(true);
  };

  const handleDrawerRoomChange = (direction) => {
    if (rooms.length < 2) return;
    const currentIndex = rooms.findIndex((room) => getRoomName(room) === form.room);
    const nextIndex = (currentIndex + direction + rooms.length) % rooms.length;
    const nextRoom = getRoomName(rooms[nextIndex]);
    if (nextRoom) {
      setField("room")(nextRoom);
      setDrawerImageError(false);
    }
  };

  const timesValid =
    !!form.startTime && !!form.endTime && form.startTime < form.endTime;
  const canContinueStep0 =
    !!form.date && !!form.room && timesValid && !conflict;
  const canContinueStep1 =
    !!form.employeeId && !!form.empName && !!form.email && !!form.ma;

  if (loading)
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Skeleton
          variant="rectangular"
          height={72}
          sx={{ borderRadius: 2.5, mb: 2 }}
        />
        <Skeleton
          variant="rectangular"
          height={240}
          sx={{ borderRadius: 2.5, mb: 2 }}
        />
        <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 2.5 }} />
      </Container>
    );

  // ============================================
  // DRAWER CONTENT
  // ============================================
  const selectedRoomData = rooms.find((r) => getRoomName(r) === form.room);
  const selectedCapacity = getRoomCapacity(selectedRoomData);
  const selectedLocation = getRoomLocation(selectedRoomData);
  const selectedFacilities = getRoomFacilities(selectedRoomData);
  const selectedDescription = getRoomDescription(selectedRoomData);
  const selectedRating = getRoomRating(selectedRoomData);
  const selectedImage = getRoomImage(selectedRoomData);
  const availabilityStatus = roomAvailability[form.room] || "unknown";
  const isConfirming =
    !form.date || bookingsLoadedFor !== form.date || checkingConflicts;
  const hasTime = !!(form.startTime && form.endTime);
  const showDrawerImage = !!selectedImage && !drawerImageError;

  const drawerContent = (
    <Box sx={{ height: "100%", overflowY: "auto" }}>
      {showDrawerImage && (
        <Box
          sx={{
            position: "relative",
            width: "100%",
            aspectRatio: "16 / 9",
            bgcolor: T.primaryTint,
          }}
        >
          <Box
            component="img"
            src={selectedImage}
            alt={`${form.room} room`}
            onError={() => setDrawerImageError(true)}
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <IconButton
            aria-label="Close drawer"
            onClick={() => setDrawerOpen(false)}
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              bgcolor: "rgba(255,255,255,0.92)",
              "&:hover": { bgcolor: "#fff" },
            }}
            size="small"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
        {!showDrawerImage && (
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 1,
              mb: 2,
            }}
          >
            <Box>
              <Typography
                sx={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  letterSpacing: 1,
                  color: T.textSecondary,
                  textTransform: "uppercase",
                }}
              >
                Selected room
              </Typography>
            </Box>
            <IconButton
              aria-label="Close drawer"
              onClick={() => setDrawerOpen(false)}
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        )}

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Typography
            variant="h6"
            fontWeight={700}
            sx={{ color: T.navy, lineHeight: 1.25, minWidth: 0 }}
          >
            {form.room || "No room selected"}
          </Typography>
          <Box sx={{ display: "flex", flexShrink: 0 }}>
            <IconButton
              aria-label="Previous room"
              title="Previous room"
              size="small"
              disabled={rooms.length < 2}
              onClick={() => handleDrawerRoomChange(-1)}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <IconButton
              aria-label="Next room"
              title="Next room"
              size="small"
              disabled={rooms.length < 2}
              onClick={() => handleDrawerRoomChange(1)}
            >
              <ArrowForwardIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {selectedLocation && (
          <Box
            sx={{ display: "flex", alignItems: "center", gap: 0.4, mt: 0.5 }}
          >
            <LocationOnIcon sx={{ fontSize: 14, color: T.textSecondary }} />
            <Typography sx={{ fontSize: "0.8rem", color: T.textSecondary }}>
              {selectedLocation}
            </Typography>
          </Box>
        )}

        <Box
          sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1.5, mb: 2 }}
        >
          {selectedCapacity && (
            <Chip
              icon={<PeopleIcon sx={{ fontSize: 14 }} />}
              label={`${selectedCapacity} seats`}
              size="small"
              sx={{ bgcolor: T.neutralBg, fontWeight: 600 }}
            />
          )}
          {selectedRating && (
            <Chip
              icon={<StarIcon sx={{ fontSize: 14, color: "#F59E0B" }} />}
              label={`${selectedRating.rating.toFixed(1)}${selectedRating.reviews ? ` · ${selectedRating.reviews} reviews` : ""}`}
              size="small"
              sx={{ bgcolor: T.neutralBg, fontWeight: 600 }}
            />
          )}
          <AvailabilityBadge
            status={availabilityStatus}
            checking={isConfirming}
          />
        </Box>

        {selectedDescription && (
          <Typography
            sx={{
              fontSize: "0.82rem",
              color: T.textSecondary,
              lineHeight: 1.55,
              mb: 2,
            }}
          >
            {selectedDescription}
          </Typography>
        )}

        {selectedFacilities.length > 0 && (
          <Box sx={{ mb: 2.5 }}>
            <Typography
              sx={{
                fontSize: "0.72rem",
                fontWeight: 600,
                color: T.textSecondary,
                mb: 0.5,
              }}
            >
              Facilities
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {selectedFacilities.map((f, i) => (
                <FacilPill key={`${f}-${i}`} label={f} />
              ))}
            </Box>
          </Box>
        )}

        <Divider sx={{ my: 2, borderColor: T.border }} />

        <Typography
          sx={{
            fontSize: "0.72rem",
            fontWeight: 700,
            letterSpacing: 1,
            color: T.textSecondary,
            textTransform: "uppercase",
            mb: 1.5,
          }}
        >
          Choose a time
        </Typography>

        <Grid container spacing={1.5}>
          <Grid item xs={6}>
            <TextField
              fullWidth
              size="small"
              label="Start"
              type="time"
              value={form.startTime}
              onChange={(e) => setField("startTime")(e.target.value)}
              InputLabelProps={{ shrink: true }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <AccessTimeIcon
                      sx={{ fontSize: 16, color: T.textSecondary }}
                    />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              fullWidth
              size="small"
              label="End"
              type="time"
              value={form.endTime}
              onChange={(e) => setField("endTime")(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>

        {hasTime && timesValid && (
          <Typography sx={{ fontSize: "0.78rem", color: T.textSecondary, mt: 1 }}>
            Duration:{" "}
            <Box component="span" sx={{ color: T.navy, fontWeight: 600 }}>
              {calculateDuration(form.startTime, form.endTime)}
            </Box>
          </Typography>
        )}
        {hasTime && !timesValid && (
          <Alert severity="warning" sx={{ mt: 1.5, borderRadius: 2 }}>
            End time must be after start time.
          </Alert>
        )}

        {selectedBookings.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography
              sx={{
                fontSize: "0.72rem",
                fontWeight: 700,
                color: "#B42318",
                mb: 0.75,
              }}
            >
              Already booked on this date ({selectedBookings.length})
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
                gap: 0.8,
              }}
            >
              {selectedBookings.map((b) => (
                <Chip
                  key={b._id || `${b.startTime}-${b.endTime}`}
                  label={`${b.startTime} – ${b.endTime}`}
                  size="small"
                  sx={{
                    width: "100%",
                    justifyContent: "flex-start",
                    height: 38,
                    bgcolor: "#FFF1F2",
                    color: "#B42318",
                    border: "1px solid #FDA4AF",
                    boxShadow: "0 2px 6px rgba(190, 24, 93, 0.08)",
                    fontWeight: 700,
                    fontSize: "0.78rem",
                    fontVariantNumeric: "tabular-nums",
                    "& .MuiChip-label": { px: 1.25 },
                    "&:hover": { bgcolor: "#FFE4E6" },
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        {conflict && (
          <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
            {conflict}
          </Alert>
        )}

        <Box sx={{ display: "flex", gap: 1, mt: 3 }}>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => setDrawerOpen(false)}
            sx={{ borderColor: T.border, color: T.navy }}
          >
            Cancel
          </Button>
          <Button
            fullWidth
            variant="contained"
            onClick={() => setDrawerOpen(false)}
            disabled={!timesValid}
            sx={{
              bgcolor: T.primary,
              "&:hover": { bgcolor: T.primaryHover },
            }}
          >
            Save times
          </Button>
        </Box>
      </Box>
    </Box>
  );

  // ============================================
  // STEP 1 (details)
  // ============================================
  const detailsBody = (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.5, sm: 2 },
        borderRadius: 2.5,
        border: '1px solid ' + T.border,
        bgcolor: T.card,
      }}
    >
      <Grid container spacing={2} className="booking-details-grid">

        <Grid item xs={12} md={5} className="booking-details-cell-employee-id">
          <Box className="booking-details-field-card">
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
                    <BadgeIcon sx={{ color: T.primary }} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </Grid>

        <Grid item xs={12} md={5} className="booking-details-cell-employee-name">
          <Box className="booking-details-field-card">
            <TextField
              label="Employee name"
              value={form.empName}
              fullWidth
              InputProps={{
                readOnly: true,
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon sx={{ color: T.primary }} />
                  </InputAdornment>
                ),
                endAdornment: allEmployees.some(
                  (e) => e.employeeId === form.employeeId,
                ) ? (
                  <InputAdornment position="end">
                    <CheckCircleIcon color="success" fontSize="small" />
                  </InputAdornment>
                ) : null,
              }}
            />
          </Box>
        </Grid>

        <Grid item xs={12} md={4} className="booking-details-cell-email">
          <Box className="booking-details-field-card booking-details-tall-card">
            <Typography className="booking-details-field-label">
              Organizer email <span>*</span>
            </Typography>
            <CreatableSelect
              value={form.email ? { value: form.email, label: form.email } : null}
              onChange={(v) => setField("email")(v?.value || "")}
              onCreateOption={(value) => setField("email")(value)}
              options={emailOptions}
              isLoading={emailLoading}
              onInputChange={searchEmails}
              isClearable
              styles={{
                control: (b) => ({
                  ...b,
                  borderRadius: 10,
                  borderColor: T.border,
                  "&:hover": { borderColor: T.primary },
                  minHeight: 56,
                }),
                option: (b, { isFocused }) => ({
                  ...b,
                  backgroundColor: isFocused ? T.primaryTint : "white",
                  color: T.navy,
                }),
                placeholder: (b) => ({ ...b, color: "#9E9E9E" }),
              }}
              placeholder="Enter or select email"
            />
          </Box>
        </Grid>

        <Grid item xs={12} md={3} className="booking-details-cell-cc">
          <Box className="booking-details-field-card booking-details-tall-card">
            <Typography className="booking-details-field-label">
              CC email <span className="optional-label">Optional</span>
            </Typography>
            <CreatableSelect
              isMulti
              value={form.cc.map((c) => ({ value: c, label: c }))}
              onChange={(v) => setField("cc")(v ? v.map((o) => o.value) : [])}
              options={emailOptions}
              isLoading={emailLoading}
              onInputChange={searchEmails}
              styles={{
                control: (b) => ({
                  ...b,
                  borderRadius: 10,
                  borderColor: T.border,
                  "&:hover": { borderColor: T.primary },
                  minHeight: 56,
                  maxHeight: 112,
                  minWidth: 0,
                  overflow: "hidden",
                }),
                valueContainer: (b) => ({
                  ...b,
                  minWidth: 0,
                  flexWrap: "wrap",
                  gap: 2,
                  maxHeight: 88,
                  overflowY: "auto",
                }),
                multiValue: (b) => ({
                  ...b,
                  maxWidth: "100%",
                  minWidth: 0,
                  margin: 2,
                  backgroundColor: T.primaryTint,
                }),
                multiValueLabel: (b) => ({
                  ...b,
                  minWidth: 0,
                  color: T.navy,
                  overflowWrap: "anywhere",
                  whiteSpace: "normal",
                }),
                placeholder: (b) => ({ ...b, color: "#9E9E9E" }),
              }}
              placeholder="Add attendees"
            />
          </Box>
        </Grid>

        <Grid item xs={12} md={3} className="booking-details-cell-recurrence">
          <Box className="booking-details-field-card booking-details-tall-card">
            <Box className="booking-details-heading">
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  Recurrence
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Repeat this booking (optional)
                </Typography>
              </Box>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  select
                  fullWidth
                  label="Repeat"
                  value={recurrence.type}
                  onChange={(e) =>
                    setRecurrence({ ...recurrence, type: e.target.value })
                  }
                  SelectProps={{ native: true }}
                >
                  <option value="none">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </TextField>
              </Grid>
              {recurrence.type !== "none" && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Repeat until"
                    value={recurrence.endDate}
                    onChange={(e) =>
                      setRecurrence({ ...recurrence, endDate: e.target.value })
                    }
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              )}
            </Grid>
          </Box>
        </Grid>

        <Grid item xs={12} md={4} className="booking-details-cell-agenda">
          <Box className="booking-details-field-card booking-details-tall-card">
            <Box className="booking-details-heading">
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  Meeting information
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Add a short purpose or agenda
                </Typography>
              </Box>
            </Box>
            <TextField
              fullWidth
              label="Agenda *"
              value={form.ma}
              onChange={(e) => setField("ma")(e.target.value)}
              multiline
              minRows={4}
              placeholder="Purpose and key points"
            />
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );

  // STEP 2 (review)
  // ============================================
  const ReviewBlock = ({ title, editStep, children }) => (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 2,
        border: `1px solid ${T.border}`,
        bgcolor: T.card,
        mb: 1.5,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 1,
        }}
      >
        <Typography
          sx={{
            fontSize: "0.72rem",
            fontWeight: 700,
            letterSpacing: 1,
            color: T.textSecondary,
            textTransform: "uppercase",
          }}
        >
          {title}
        </Typography>
        <Button
          size="small"
          onClick={() => setActiveStep(editStep)}
          sx={{ color: T.primary, minWidth: 0, fontSize: "0.75rem", p: 0.5 }}
        >
          Edit
        </Button>
      </Box>
      <Box>{children}</Box>
    </Paper>
  );

  const ReviewRow = ({ label, value }) => (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 2,
        py: 0.5,
      }}
    >
      <Typography sx={{ fontSize: "0.78rem", color: T.textSecondary }}>
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: "0.85rem",
          fontWeight: 600,
          color: value ? T.navy : "#94A3B8",
          textAlign: "right",
          maxWidth: "65%",
          wordBreak: "break-word",
        }}
      >
        {value || "Not set"}
      </Typography>
    </Box>
  );

  const reviewBody = (
    <Box>
      <ReviewBlock title="Room & schedule" editStep={0}>
        <ReviewRow label="Room" value={form.room} />
        <ReviewRow label="Date" value={formatDateDisplay(form.date)} />
        <ReviewRow
          label="Time"
          value={
            form.startTime && form.endTime
              ? `${form.startTime} – ${form.endTime}`
              : ""
          }
        />
        <ReviewRow
          label="Duration"
          value={calculateDuration(form.startTime, form.endTime)}
        />
      </ReviewBlock>

      <ReviewBlock title="Organizer" editStep={1}>
        <ReviewRow
          label="Employee"
          value={form.empName ? `${form.empName} (${form.employeeId})` : ""}
        />
        <ReviewRow label="Email" value={form.email} />
        {form.cc.length > 0 && (
          <ReviewRow label="CC" value={form.cc.join(", ")} />
        )}
      </ReviewBlock>

      <ReviewBlock title="Meeting" editStep={1}>
        <ReviewRow label="Agenda" value={form.ma} />
        <ReviewRow
          label="Recurrence"
          value={
            recurrence.type === "none"
              ? "None"
              : `${recurrence.type}${recurrence.endDate ? ` until ${recurrence.endDate}` : ""}`
          }
        />
      </ReviewBlock>
    </Box>
  );

  // ============================================
  // RENDER
  // ============================================
  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: T.bg,
          py: { xs: 2, sm: 3 },
          pb: { xs: 4, sm: 6 },
        }}
      >
        <Container maxWidth="md">
          {success && (
            <Alert
              severity="success"
              variant="filled"
              onClose={() => setSuccess("")}
              sx={{
                position: "fixed",
                top: 20,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 9999,
                borderRadius: 2.5,
                bgcolor: T.success,
                minWidth: 260,
              }}
            >
              {success}
            </Alert>
          )}
          {error && (
            <Alert
              severity="error"
              onClose={() => setError("")}
              sx={{
                position: "fixed",
                top: 20,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 9999,
                borderRadius: 2.5,
                minWidth: 260,
                maxWidth: 520,
                boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
              }}
            >
              {error}
            </Alert>
          )}

        
          <form onSubmit={handleSubmit} noValidate>
            {activeStep === 0 && (
              <>
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 2.5, sm: 3 },
                    borderRadius: 2.5,
                    border: `1px solid ${T.border}`,
                    bgcolor: T.card,
                    mb: 2,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      letterSpacing: 1,
                      color: T.textSecondary,
                      textTransform: "uppercase",
                      mb: 1,
                    }}
                  >
                    Step 1 · Date
                  </Typography>
                  <TextField
                    type="date"
                    label="Meeting date"
                    value={form.date}
                    onChange={(e) => setField("date")(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{
                      min: new Date().toISOString().split("T")[0],
                    }}
                    sx={{ maxWidth: 300, width: "100%" }}
                  />
                </Paper>

                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 2.5, sm: 3 },
                    borderRadius: 2.5,
                    border: `1px solid ${T.border}`,
                    bgcolor: T.card,
                    mb: 2,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      letterSpacing: 1,
                      color: T.textSecondary,
                      textTransform: "uppercase",
                      mb: 1,
                    }}
                  >
                    Step 2 · Room
                  </Typography>

                  {!form.room ? (
                    <Box>
                      <Typography
                        sx={{
                          fontSize: "0.85rem",
                          color: T.textSecondary,
                          mb: 1.5,
                        }}
                      >
                        Browse {rooms.length} room
                        {rooms.length === 1 ? "" : "s"} with photos and details.
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<MeetingRoomIcon />}
                        onClick={() => setRoomModalOpen(true)}
                        disabled={!form.date}
                        sx={{
                          bgcolor: T.primary,
                          "&:hover": { bgcolor: T.primaryHover },
                        }}
                      >
                        Choose a room
                      </Button>
                      {!form.date && (
                        <Typography
                          sx={{
                            fontSize: "0.75rem",
                            color: T.textSecondary,
                            mt: 1,
                          }}
                        >
                          Pick a date first.
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <Box>
                      {/* Compact selected-room preview with photo */}
                      <Box
                        sx={{
                          display: "flex",
                          gap: 1.5,
                          alignItems: "center",
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor: T.primarySoft,
                          border: `1px solid ${T.primary}`,
                          flexWrap: { xs: "wrap", sm: "nowrap" },
                        }}
                      >
                        {(() => {
                          const media = getRoomMedia(form.room);
                          const img = getRoomImage(selectedRoomData);
                          return img ? (
                            <Box
                              component="img"
                              src={img}
                              alt={form.room}
                              sx={{
                                width: 88,
                                height: 66,
                                borderRadius: 1.5,
                                objectFit: "cover",
                                flexShrink: 0,
                              }}
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <Box
                              sx={{
                                width: 88,
                                height: 66,
                                borderRadius: 1.5,
                                bgcolor: T.primaryTint,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              <MeetingRoomIcon
                                sx={{ color: T.primary }}
                              />
                            </Box>
                          );
                        })()}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            sx={{
                              fontWeight: 700,
                              color: T.navy,
                              fontSize: "0.9rem",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {form.room}
                          </Typography>
                          {selectedLocation && (
                            <Typography
                              sx={{
                                fontSize: "0.74rem",
                                color: T.textSecondary,
                                mt: 0.25,
                              }}
                            >
                              {selectedLocation}
                            </Typography>
                          )}
                          <Box
                            sx={{ display: "flex", gap: 0.5, mt: 0.5 }}
                          >
                            {selectedCapacity && (
                              <Chip
                                icon={
                                  <PeopleIcon sx={{ fontSize: 12 }} />
                                }
                                label={`${selectedCapacity} seats`}
                                size="small"
                                sx={{
                                  bgcolor: "#fff",
                                  fontWeight: 600,
                                  fontSize: "0.68rem",
                                  height: 22,
                                }}
                              />
                            )}
                          </Box>
                        </Box>
                        <Box
                          sx={{
                            display: "flex",
                            gap: 0.5,
                            flexShrink: 0,
                            ml: "auto",
                          }}
                        >
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setDrawerOpen(true)}
                            sx={{
                              borderColor: T.primary,
                              color: T.primary,
                              "&:hover": { bgcolor: "#fff" },
                              minWidth: 0,
                              fontSize: "0.72rem",
                            }}
                          >
                            Details
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setRoomModalOpen(true)}
                            sx={{
                              borderColor: T.border,
                              color: T.navy,
                              "&:hover": { borderColor: T.primary },
                              minWidth: 0,
                              fontSize: "0.72rem",
                            }}
                          >
                            Change
                          </Button>
                        </Box>
                      </Box>
                    </Box>
                  )}
                </Paper>

                {form.room && (
                  <Paper
                    elevation={0}
                    sx={{
                      p: { xs: 2.5, sm: 3 },
                      borderRadius: 2.5,
                      border: `1px solid ${T.border}`,
                      bgcolor: T.card,
                      mb: 2,
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        letterSpacing: 1,
                        color: T.textSecondary,
                        textTransform: "uppercase",
                        mb: 1,
                      }}
                    >
                      Step 3 · Time
                    </Typography>

                    {timesValid ? (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          flexWrap: "wrap",
                        }}
                      >
                        <Box
                          sx={{
                            px: 1.5,
                            py: 0.75,
                            borderRadius: 2,
                            bgcolor: T.primarySoft,
                            border: `1px solid ${T.primary}`,
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                          }}
                        >
                          <AccessTimeIcon
                            sx={{ fontSize: 18, color: T.primary }}
                          />
                          <Typography
                            sx={{
                              fontWeight: 700,
                              color: T.navy,
                              fontSize: "0.9rem",
                            }}
                          >
                            {form.startTime} – {form.endTime}
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: "0.75rem",
                              color: T.textSecondary,
                            }}
                          >
                            · {calculateDuration(form.startTime, form.endTime)}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setDrawerOpen(true)}
                          sx={{
                            borderColor: T.border,
                            color: T.navy,
                            "&:hover": { borderColor: T.primary },
                          }}
                        >
                          Edit times
                        </Button>
                      </Box>
                    ) : (
                      <Box>
                        <Typography
                          sx={{
                            fontSize: "0.85rem",
                            color: T.textSecondary,
                            mb: 1.5,
                          }}
                        >
                          Set a start and end time for{" "}
                          <Box
                            component="span"
                            sx={{ fontWeight: 600, color: T.navy }}
                          >
                            {form.room}
                          </Box>
                          .
                        </Typography>
                        <Button
                          variant="contained"
                          startIcon={<AccessTimeIcon />}
                          onClick={() => setDrawerOpen(true)}
                          sx={{
                            bgcolor: T.primary,
                            "&:hover": { bgcolor: T.primaryHover },
                          }}
                        >
                          Set times
                        </Button>
                      </Box>
                    )}

                    {conflict && (
                      <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
                        {conflict}
                      </Alert>
                    )}
                  </Paper>
                )}

                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 1,
                    mt: 2,
                  }}
                >
                  <Button
                    variant="outlined"
                    onClick={handleReset}
                    startIcon={<RefreshIcon />}
                    sx={{
                      borderColor: T.border,
                      color: T.navy,
                      "&:hover": { borderColor: T.primary },
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    endIcon={<ArrowForwardIcon />}
                    disabled={!canContinueStep0}
                    sx={{
                      bgcolor: T.primary,
                      "&:hover": { bgcolor: T.primaryHover },
                    }}
                  >
                    Continue
                  </Button>
                </Box>
              </>
            )}

            {activeStep === 1 && (
              <>
                {detailsBody}
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 1,
                    mt: 2,
                  }}
                >
                  <Button
                    variant="outlined"
                    onClick={handleBack}
                    startIcon={<ArrowBackIcon />}
                    sx={{
                      borderColor: T.border,
                      color: T.navy,
                      "&:hover": { borderColor: T.primary },
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    endIcon={<ArrowForwardIcon />}
                    disabled={!canContinueStep1}
                    sx={{
                      bgcolor: T.primary,
                      "&:hover": { bgcolor: T.primaryHover },
                    }}
                  >
                    Continue
                  </Button>
                </Box>
              </>
            )}

            {activeStep === 2 && (
              <>
                {reviewBody}
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 1,
                    mt: 2,
                  }}
                >
                  <Button
                    variant="outlined"
                    onClick={handleBack}
                    startIcon={<ArrowBackIcon />}
                    sx={{
                      borderColor: T.border,
                      color: T.navy,
                      "&:hover": { borderColor: T.primary },
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={submitting || progress < 100}
                    startIcon={
                      submitting ? (
                        <CircularProgress size={16} sx={{ color: "white" }} />
                      ) : (
                        <SendIcon />
                      )
                    }
                    sx={{
                      bgcolor: T.primary,
                      "&:hover": { bgcolor: T.primaryHover },
                      px: 3,
                    }}
                  >
                    {submitting ? "Submitting…" : "Confirm booking"}
                  </Button>
                </Box>
              </>
            )}
          </form>
        </Container>

        {/* ---- ROOM SELECTOR (wheel + gallery) ---- */}
        <Dialog
          open={roomModalOpen}
          onClose={() => setRoomModalOpen(false)}
          maxWidth="md"
          fullWidth
          fullScreen={isMobile}
        >
          <DialogTitle
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: `1px solid ${T.border}`,
              pb: 1.5,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, color: T.navy }}>
              Choose a room
            </Typography>
            <IconButton
              onClick={() => setRoomModalOpen(false)}
              aria-label="Close room selector"
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers sx={{ borderColor: T.border }}>
            {/* Wheel */}
            <RoomWheel
              rooms={rooms}
              selectedName={form.room}
              onSelect={handleSelectRoom}
            />

            

            
          </DialogContent>
        </Dialog>

        {/* ---- ROOM DETAILS DRAWER ---- */}
        <Drawer
          anchor={isMobile ? "bottom" : "right"}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          PaperProps={{
            sx: {
              width: isMobile ? "100%" : 440,
              height: isMobile ? "88vh" : "100%",
              borderRadius: isMobile ? "16px 16px 0 0" : 0,
              borderTopLeftRadius: isMobile ? "16px" : 0,
              borderTopRightRadius: isMobile ? "16px" : 0,
            },
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>
    </ThemeProvider>
  );
};

export default BookingForm;
