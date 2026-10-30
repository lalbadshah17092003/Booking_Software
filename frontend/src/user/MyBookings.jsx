import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import "./BookingForm.css";
import CreatableSelect from "react-select/creatable";
import { jwtDecode } from "jwt-decode";
import debounce from "lodash/debounce";
import { motion, AnimatePresence } from "framer-motion";
import {
  Box, Typography, TextField, Button, Chip, CircularProgress,
  IconButton, Alert, AlertTitle, Divider, LinearProgress,
  InputAdornment, Avatar, Skeleton, Container, Paper, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from "@mui/material";
import {
  AccessTime as AccessTimeIcon, Person as PersonIcon,
  Description as DescriptionIcon, Refresh as RefreshIcon,
  Cancel as CancelIcon, Warning as WarningIcon,
  ArrowBack as ArrowBackIcon, ArrowForward as ArrowForwardIcon,
  Send as SendIcon, CalendarToday as CalendarIcon,
  MeetingRoom as MeetingRoomIcon, History as HistoryIcon,
  Badge as BadgeIcon, ErrorOutline as ErrorOutlineIcon,
  CheckCircle as CheckCircleIcon, EventBusy as EventBusyIcon,
  Timeline as TimelineIcon, Schedule as ScheduleIcon, Today as TodayIcon,
} from "@mui/icons-material";
import RoomSelectionModal from "./RoomSelectionModal";
import { ThemeProvider, createTheme } from "@mui/material/styles";

// ============================================
// API & SERVICE HELPERS (compressed)
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
  return Array.isArray(data?.data) ? data.data : Array.isArray(data?.results) ? data.results : [];
};

const normDate = (v) => (!v ? "" : String(v).match(/^\d{4}-\d{2}-\d{2}/)?.[0] || new Date(v).toISOString().split("T")[0] || "");
const normText = (v) => String(v || "").trim().toLowerCase();
const overlap = (s1, e1, s2, e2) => s1 < e2 && e1 > s2;
const sameRoom = (a, b) => normText(a) === normText(b);
const sameDate = (a, b) => normDate(a) === normDate(b);
const blockingStatus = (s) => ["approved", "ongoing"].includes(normText(s));

const statusColor = (s) => ({
  approved: { bg: "#E8F5E9", text: "#2E7D32" },
  pending: { bg: "#FFF3E0", text: "#E65100" },
  cancelled: { bg: "#F3E5F5", text: "#6A1B9A" },
  ongoing: { bg: "#E3F2FD", text: "#1565C0" },
  completed: { bg: "#E8F5E9", text: "#1B5E20" },
}[normText(s)] || { bg: "#F5F5F5", text: "#616161" });



// ============================================
// MODERN THEME
// ============================================
const theme = createTheme({
  palette: {
    primary: { main: "#6C63FF", light: "#9D97FF", dark: "#4A42DB" },
    secondary: { main: "#FF6584" },
    success: { main: "#00C9A7" },
    warning: { main: "#FFB84D" },
    error: { main: "#FF5C5C" },
    background: { default: "#F8F9FE", paper: "#FFFFFF" },
  },
  typography: { fontFamily: '"Inter", "Poppins", sans-serif', h5: { fontWeight: 700 }, button: { textTransform: "none", fontWeight: 600 } },
  shape: { borderRadius: 16 },
  components: {
    MuiButton: { styleOverrides: { root: { borderRadius: 12, padding: "10px 24px" }, contained: { boxShadow: "0 4px 14px rgba(108,99,255,0.39)" } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 8 } } },
  },
});

// ============================================
// MAIN COMPONENT
// ============================================
const BookingForm = () => {
  const steps = [
    { label: "Room & Date", icon: <MeetingRoomIcon />, color: "#6C63FF" },
    { label: "Schedule", icon: <AccessTimeIcon />, color: "#FF6584" },
    { label: "Details", icon: <DescriptionIcon />, color: "#00C9A7" },
    { label: "Review", icon: <CheckCircleIcon />, color: "#FFB84D" },
  ];

  const [activeStep, setActiveStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [form, setForm] = useState({
    empName: "", employeeId: "", date: "", startTime: "", endTime: "",
    email: "", room: "", ma: "", bookedBy: "", cc: [],
  });
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [recurrence, setRecurrence] = useState({ type: "none", endDate: "" });
  const [emailOptions, setEmailOptions] = useState([]);
  const [emailLoading, setEmailLoading] = useState(false);
  const [allEmployees, setAllEmployees] = useState([]);

  const setField = (field) => (value) => setForm(prev => ({ ...prev, [field]: value }));

  const selectedBookings = useMemo(() =>
    bookings.filter(b => sameRoom(b.room, form.room) && sameDate(b.date, form.date) && ["pending","approved","ongoing","completed"].includes(normText(b.status)))
    .sort((a,b) => String(a.startTime).localeCompare(String(b.startTime)))
  , [bookings, form.room, form.date]);

  const calculateDuration = (s, e) => {
    if (!s || !e) return "0h 0m";
    const diff = new Date(`2000-01-01T${e}`) - new Date(`2000-01-01T${s}`);
    return `${Math.floor(diff/3600000)}h ${Math.floor((diff%3600000)/60000)}m`;
  };

  const progress = useMemo(() => {
    let p = 0;
    const fields = [form.date, form.room, form.startTime, form.endTime, form.empName, form.employeeId, form.email, form.ma];
    const filled = fields.filter(Boolean).length;
    p = Math.min(100, (filled / fields.length) * 85 + (activeStep === 3 ? 15 : 0));
    return p;
  }, [activeStep, form]);

  // ============================================
  // DATA FETCHING
  // ============================================
  const fetchBookings = useCallback(async () => {
    try {
      const { data } = await api.get("/booking", { params: { limit: 100, room: form.room, date: form.date, status: "pending,approved,ongoing,completed" } });
      setBookings(getArray(data, ["bookings"]));
    } catch (e) { console.error(e); }
  }, [form.room, form.date]);

  const checkConflicts = useCallback(async () => {
    if (!form.room || !form.date || !form.startTime || !form.endTime) return;
    setCheckingConflicts(true);
    try {
      const { data } = await api.get("/booking", { params: { limit: 100 } });
      const all = getArray(data, ["bookings"]);
      const conflicts = all.filter(b =>
        sameRoom(b.room, form.room) && sameDate(b.date, form.date) &&
        blockingStatus(b.status) &&
        overlap(b.startTime, b.endTime, form.startTime, form.endTime)
      );
      setConflict(conflicts.length ? "Time conflicts with existing booking. Try different time." : "");
    } catch (e) { console.error(e); }
    finally { setCheckingConflicts(false); }
  }, [form.room, form.date, form.startTime, form.endTime]);

  useEffect(() => { 
    (async () => {
      setLoading(true);
      try {
        const [{ data: r }, { data: emp }] = await Promise.all([
          api.get("/rooms", { params: { limit: 50 } }),
          api.get(`${API_BASE}/employees`),
        ]);
        setRooms(getArray(r, ["rooms"]));
        setAllEmployees(emp.data || emp || []);
        const token = sessionStorage.getItem("token");
        if (token) setForm(prev => ({ ...prev, bookedBy: jwtDecode(token).employeeId }));
        // Initial emails
        const { data: emails } = await axios.get(`${API_BASE}/email-entry/list`, { params: { limit: 50 } });
        setEmailOptions((emails.data || emails || []).map(e => ({ value: e.emailId, label: `${e.firstName||""} ${e.lastName||""} <${e.emailId}>`.trim() })));
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  useEffect(() => { if (form.room && form.date) fetchBookings(); }, [form.room, form.date, fetchBookings]);
  useEffect(() => { if (form.room && form.date && form.startTime && form.endTime) checkConflicts(); }, [form.room, form.date, form.startTime, form.endTime, checkConflicts]);

  // Auto-fill employee name
  useEffect(() => {
    if (/^AP\d{4}$/.test(form.employeeId)) {
      const emp = allEmployees.find(e => e.employeeId === form.employeeId);
      if (emp) {
        setForm(prev => ({ ...prev, empName: emp.name, email: emp.email || prev.email }));
      } else {
        setForm(prev => ({ ...prev, empName: "", email: "" }));
      }
    }
  }, [form.employeeId, allEmployees]);

  // ============================================
  // EMAIL HANDLERS
  // ============================================
  const searchEmails = useCallback(debounce(async (q) => {
    setEmailLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/email-entry/list`, { params: { search: q, limit: 50 } });
      setEmailOptions((data.data || data || []).map(e => ({ value: e.emailId, label: `${e.firstName||""} ${e.lastName||""} <${e.emailId}>`.trim() })));
    } catch (e) { console.error(e); }
    setEmailLoading(false);
  }, 500), []);

  // ============================================
  // VALIDATION
  // ============================================
  const validate = () => {
    if (!form.startTime || !form.endTime) { setError("Times required"); return false; }
    const s = new Date(`${form.date}T${form.startTime}`);
    const e = new Date(`${form.date}T${form.endTime}`);
    if (s >= e) { setError("End must be after start"); return false; }
    if (s < new Date()) { setError("Cannot book in past"); return false; }
    setError("");
    return true;
  };

  // ============================================
  // SUBMIT
  // ============================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.empName || !form.employeeId || !form.date || !form.startTime || !form.endTime || !form.email || !form.room || !form.ma || !form.bookedBy) {
      setError("All fields required"); return;
    }
    if (!validate()) return;
    setSubmitting(true);
    try {
      await api.post("/booking", { ...form, cc: form.cc.join(", "), ...recurrence });
      setSuccess("Booking Submitted Successfully!");
      setTimeout(() => { setSuccess(""); setForm({ empName: "", employeeId: "", date: "", startTime: "", endTime: "", email: "", room: "", ma: "", bookedBy: form.bookedBy, cc: [] }); setActiveStep(0); }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Submission failed");
    }
    setSubmitting(false);
  };

  const handleNext = () => {
    if (activeStep === 0 && (!form.date || !form.room)) { setError("Select date and room"); return; }
    if (activeStep === 1) { if (!validate()) return; if (conflict) { setError(conflict); return; } }
    setError(""); setDirection(1); setActiveStep(p => Math.min(p + 1, 3));
  };

  const handleBack = () => { setError(""); setDirection(-1); setActiveStep(p => Math.max(p - 1, 0)); };

  // ============================================
  // TIME SLOT VISUALIZER
  // ============================================
  const TimeSlotVisualizer = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const bookedH = new Set(selectedBookings.filter(b => blockingStatus(b.status)).flatMap(b => {
      const r = []; for (let h = parseInt(b.startTime); h < parseInt(b.endTime); h++) r.push(h); return r;
    }));
    const selectedH = new Set(form.startTime && form.endTime ? (() => {
      const r = []; for (let h = parseInt(form.startTime); h < parseInt(form.endTime); h++) r.push(h); return r;
    })() : []);
    const isToday = form.date === new Date().toISOString().split("T")[0];
    const nowH = new Date().getHours();

    return (
      <Box sx={{ mt: 2, p: 2, bgcolor: "background.default", borderRadius: 3 }}>
        <Box display="flex" justifyContent="space-between" mb={2}>
          <Typography variant="subtitle2" fontWeight="bold"><TimelineIcon fontSize="small" color="primary" /> Availability</Typography>
          <Box display="flex" gap={1}>
            {[{ color: "error.main", label: "Booked" }, { color: "primary.main", label: "Selected" }].map(l => (
              <Box key={l.label} display="flex" alignItems="center" gap={0.5}>
                <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: l.color, opacity: 0.3, border: `1px solid ${l.color}` }} />
                <Typography variant="caption">{l.label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 0.5, overflowX: "auto", pb: 1 }}>
          {hours.map(h => {
            const booked = bookedH.has(h), selected = selectedH.has(h), past = isToday && h < nowH;
            return (
              <Box key={h} onClick={() => {
                if (!booked && !past) {
                  const t = `${String(h).padStart(2,"0")}:00`;
                  if (!form.startTime) setField("startTime")(t);
                  else if (!form.endTime && t > form.startTime) setField("endTime")(t);
                  else { setField("startTime")(t); setField("endTime")(""); }
                }
              }}
              sx={{
                width: 48, height: 52, borderRadius: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                cursor: booked || past ? "not-allowed" : "pointer", opacity: past ? 0.5 : 1,
                bgcolor: booked ? "error.50" : selected ? "primary.50" : "transparent",
                border: 2, borderColor: booked ? "error.main" : selected ? "primary.main" : "divider",
                "&:hover": { bgcolor: booked || past ? undefined : "primary.100" }
              }}>
                <Typography variant="caption" fontWeight="bold" color={booked ? "error.main" : selected ? "primary.main" : "text.primary"}>
                  {String(h).padStart(2,"0")}
                </Typography>
                <Typography variant="caption" fontSize="0.6rem">{h < 12 ? "AM" : "PM"}</Typography>
                {booked && <EventBusyIcon sx={{ fontSize: 12, color: "error.main" }} />}
                {selected && <CheckCircleIcon sx={{ fontSize: 12, color: "primary.main" }} />}
              </Box>
            );
          })}
        </Box>
        <Box sx={{ mt: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Typography variant="caption">Quick:</Typography>
          {[{ label: "1h", h: 1 }, { label: "2h", h: 2 }, { label: "4h", h: 4 }, { label: "8h", h: 8 }].map(p => (
            <Chip key={p.label} label={p.label} size="small" variant="outlined" onClick={() => {
              const s = form.startTime || `${String(new Date().getHours()).padStart(2,"0")}:00`;
              setField("endTime")(`${String(parseInt(s) + p.h).padStart(2,"0")}:00`);
            }} />
          ))}
        </Box>
      </Box>
    );
  };

  if (loading) return <Container maxWidth="lg"><Box py={4}><Skeleton variant="rectangular" height={100} sx={{ borderRadius: 3, mb: 3 }} /><Grid container spacing={3}>{[1,2,3].map(i => <Grid item xs={12} key={i}><Skeleton variant="rectangular" height={200} sx={{ borderRadius: 3 }} /></Grid>)}</Grid></Box></Container>;

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: 4 }}>
        <Container maxWidth="lg">
          <AnimatePresence>
            {success && (
              <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ position: "fixed", top: 20, left: "50%", zIndex: 9999, transform: "translateX(-50%)" }}>
                <Alert severity="success" variant="filled" sx={{ borderRadius: 3, boxShadow: 3 }} action={<IconButton color="inherit" size="small" onClick={() => setSuccess("")}><CancelIcon /></IconButton>}>
                  <AlertTitle>Success!</AlertTitle>{success}
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Paper sx={{ p: { xs: 2, sm: 4 } }}>
              <Typography variant="h5" fontWeight="bold" mb={2}>Book a Room</Typography>
              <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3, mb: 3 }} />

              {/* Step Navigation */}
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 4, position: "relative" }}>
                <Box sx={{ position: "absolute", top: 24, left: 0, right: 0, height: 3, bgcolor: "divider", borderRadius: 1.5 }}>
                  <Box sx={{ height: "100%", width: `${(activeStep/3)*100}%`, background: "linear-gradient(90deg, #6C63FF, #FF6584, #00C9A7)", borderRadius: 1.5, transition: "width 0.3s" }} />
                </Box>
                {steps.map((s, i) => (
                  <Box key={s.label} sx={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 1, cursor: i < activeStep ? "pointer" : "default" }} onClick={() => i < activeStep && (setDirection(i > activeStep ? 1 : -1), setActiveStep(i))}>
                    <Avatar sx={{ width: 48, height: 48, bgcolor: i <= activeStep ? s.color : "grey.300" }}>{i < activeStep ? <CheckCircleIcon /> : s.icon}</Avatar>
                    <Typography variant="caption" fontWeight={i === activeStep ? "bold" : "normal"}>{s.label}</Typography>
                  </Box>
                ))}
              </Box>

              <AnimatePresence mode="wait">
                <motion.div key={activeStep} initial={{ opacity: 0, x: direction * 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: direction * -50 }} transition={{ duration: 0.3 }}>
                  <form onSubmit={handleSubmit}>
                    {/* STEP 0 */}
                    {activeStep === 0 && (
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                          <TextField type="date" label="Date" value={form.date} onChange={e => setField("date")(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} inputProps={{ min: new Date().toISOString().split("T")[0] }} />
                          <Button variant="contained" startIcon={<MeetingRoomIcon />} onClick={() => setRoomModalOpen(true)} sx={{ mt: 2 }}>Select Room</Button>
                          {form.room && <Chip label={form.room} color="primary" sx={{ mt: 2, ml: 1 }} onDelete={() => setField("room")("")} />}
                        </Grid>
                        <Grid item xs={12} md={6}>
                          {form.room && form.date ? <Paper sx={{ p: 2 }}><Typography variant="h6"><TodayIcon /> {form.room}</Typography><TimeSlotVisualizer />
                            {selectedBookings.length > 0 && (
                              <TableContainer sx={{ maxHeight: 200, mt: 2 }}>
                                <Table size="small" stickyHeader>
                                  <TableHead><TableRow>{["Time","Duration","Organizer","Status"].map(h => <TableCell key={h} sx={{ fontWeight: "bold", fontSize: "0.75rem" }}>{h}</TableCell>)}</TableRow></TableHead>
                                  <TableBody>{selectedBookings.map((b, i) => {
                                    const sc = statusColor(b.status);
                                    return <TableRow key={i}><TableCell>{b.startTime}-{b.endTime}</TableCell><TableCell>{calculateDuration(b.startTime, b.endTime)}</TableCell><TableCell>{b.empName}</TableCell><TableCell><Chip label={b.status} size="small" sx={{ bgcolor: sc.bg, color: sc.text, fontSize: "0.7rem", height: 22 }} /></TableCell></TableRow>;
                                  })}</TableBody>
                                </Table>
                              </TableContainer>
                            )}
                          </Paper> : <Paper sx={{ p: 3, textAlign: "center" }}><MeetingRoomIcon sx={{ fontSize: 60, color: "text.disabled" }} /><Typography>Select date and room</Typography></Paper>}
                        </Grid>
                      </Grid>
                    )}

                    {/* STEP 1 */}
                    {activeStep === 1 && (
                      <Grid container spacing={3}>
                        <Grid item xs={6}><TextField fullWidth label="Start Time" type="time" value={form.startTime} onChange={e => setField("startTime")(e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
                        <Grid item xs={6}><TextField fullWidth label="End Time" type="time" value={form.endTime} onChange={e => setField("endTime")(e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
                        {form.startTime && form.endTime && <Grid item xs={12}><Chip icon={<ScheduleIcon />} label={`Duration: ${calculateDuration(form.startTime, form.endTime)}`} color="primary" variant="outlined" /></Grid>}
                        <Grid item xs={12}><Divider /><Typography variant="subtitle1" mt={2}>Recurrence</Typography></Grid>
                        <Grid item xs={6}>
                          <TextField select fullWidth label="Type" value={recurrence.type} onChange={e => setRecurrence({...recurrence, type: e.target.value})} SelectProps={{ native: true }}>
                            <option value="none">None</option><option value="daily">Daily</option><option value="weekly">Weekly</option>
                          </TextField>
                        </Grid>
                        {recurrence.type !== "none" && <Grid item xs={6}><TextField fullWidth type="date" label="End Date" value={recurrence.endDate} onChange={e => setRecurrence({...recurrence, endDate: e.target.value})} InputLabelProps={{ shrink: true }} /></Grid>}
                        {conflict && <Grid item xs={12}><Alert severity="warning"><AlertTitle>Conflict</AlertTitle>{conflict}</Alert></Grid>}
                      </Grid>
                    )}

                    {/* STEP 2 */}
                    {activeStep === 2 && (
                      <Grid container spacing={3}>
                        <Grid item xs={6}>
                          <TextField label="Employee ID" value={form.employeeId} onChange={e => { let v = e.target.value.toUpperCase(); if (v.startsWith("AP")) v = v.slice(0,6); setField("employeeId")(v); }} fullWidth InputProps={{ startAdornment: <InputAdornment position="start"><BadgeIcon color="primary" /></InputAdornment> }} />
                        </Grid>
                        <Grid item xs={6}>
                          <TextField label="Employee Name" value={form.empName} fullWidth InputProps={{ readOnly: true, startAdornment: <InputAdornment position="start"><PersonIcon color="primary" /></InputAdornment> }} />
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="subtitle2" mb={1}>Organizer Email *</Typography>
                          <CreatableSelect value={form.email ? { value: form.email, label: form.email } : null} isDisabled onChange={v => setField("email")(v?.value || "")} options={emailOptions} isLoading={emailLoading} onInputChange={searchEmails} />
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="subtitle2" mb={1}>CC</Typography>
                          <CreatableSelect isMulti value={form.cc.map(c => ({ value: c, label: c }))} onChange={v => setField("cc")(v ? v.map(o => o.value) : [])} options={emailOptions} isLoading={emailLoading} onInputChange={searchEmails} />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField fullWidth label="Meeting Agenda" value={form.ma} onChange={e => setField("ma")(e.target.value)} multiline rows={4} />
                        </Grid>
                      </Grid>
                    )}

                    {/* STEP 3 */}
                    {activeStep === 3 && (
                      <Paper sx={{ p: 3, bgcolor: "background.default" }}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Booking Summary</Typography>
                        <Grid container spacing={2}>
                          {[["Room", form.room], ["Date", form.date], ["Time", `${form.startTime} - ${form.endTime}`], ["Duration", calculateDuration(form.startTime, form.endTime)], ["Organizer", `${form.empName} (${form.employeeId})`], ["Email", form.email]].map(([l, v]) => <Grid item xs={6} key={l}><Typography variant="caption" color="text.secondary">{l}</Typography><Typography fontWeight="bold">{v}</Typography></Grid>)}
                          {form.cc.length > 0 && <Grid item xs={12}><Typography variant="caption">CC: {form.cc.join(", ")}</Typography></Grid>}
                          {form.ma && <Grid item xs={12}><Typography variant="caption">Agenda:</Typography><Typography variant="body2">{form.ma}</Typography></Grid>}
                        </Grid>
                      </Paper>
                    )}

                    {error && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError("")}>{error}</Alert>}

                    <Box sx={{ display: "flex", justifyContent: "space-between", mt: 4, pt: 3, borderTop: 1, borderColor: "divider" }}>
                      <Button variant="outlined" onClick={handleBack} disabled={activeStep === 0 || submitting} startIcon={<ArrowBackIcon />}>Back</Button>
                      <Box sx={{ display: "flex", gap: 2 }}>
                        <Button variant="outlined" color="error" onClick={() => { setForm({ empName: "", employeeId: "", date: "", startTime: "", endTime: "", email: "", room: "", ma: "", bookedBy: form.bookedBy, cc: [] }); setActiveStep(0); }} startIcon={<RefreshIcon />}>Reset</Button>
                        {activeStep === 3 ? (
                          <Button type="submit" variant="contained" disabled={submitting || progress < 100 || checkingConflicts} startIcon={submitting ? <CircularProgress size={20} /> : <SendIcon />} sx={{ background: "linear-gradient(135deg, #6C63FF, #FF6584)" }}>
                            {submitting ? "Submitting..." : "Submit"}
                          </Button>
                        ) : (
                          <Button variant="contained" onClick={handleNext} endIcon={<ArrowForwardIcon />}>Next</Button>
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
      <RoomSelectionModal open={roomModalOpen} onClose={() => setRoomModalOpen(false)} onSelectRoom={r => { setField("room")(r); setRoomModalOpen(false); }} selectedRoom={form.room} date={form.date} existingBookings={bookings} />
    </ThemeProvider>
  );
};

export default BookingForm;