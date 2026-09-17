// RoomSelectionModal.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Card,
  CardMedia,
  CardContent,
  Chip,
  IconButton,
  Button,
  Badge,
  Tooltip,
  Zoom,
  Skeleton,
} from "@mui/material";
import {
  People as PeopleIcon,
  MeetingRoom as MeetingRoomIcon,
  Info as InfoIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from "@mui/icons-material";

const RoomSelectionModal = ({
  open,
  onClose,
  onSelectRoom,
  selectedRoom,
  date,
  existingBookings,
}) => {
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef(null);

  // Room data
  const rooms = [
    {
      id: 1,
      name: "Admin Conference Room",
      key: "Admin Conference Room",
      image: require("../styles/AUM_0334.webp"),
      capacity: "35+",
      amenities: ["Video Conference"],
      floor: "Admin 1st Floor",
      building: "Main Building",
      description: "...",
      rating: 4.8,
      reviews: 24,
      price: "Premium",
      size: "Large",
    },
    {
      id: 2,
      name: "QA Conference Room",
      image: require("../styles/QA_conference.webp"),
      capacity: "25+",
      amenities: ["Video Conference"],
      floor: "Admin 4th Floor",
      building: "Main Building",
      description: "...",
      rating: 4.5,
      reviews: 18,
      price: "Standard",
      size: "Medium",
    },
    {
      id: 3,
      name: "QA Training Room",
      image: require("../styles/QA_Training.webp"),
      capacity: "50+",
      amenities: ["Projector", "Whiteboard",],
      floor: "Admin 4th Floor",
      building: "Training Wing",
      description: "...",
      rating: 4.6,
      reviews: 15,
      price: "Premium",
      size: "Large",
    },
    {
      id: 4,
      name: "Meeting Room 1",
      image: require("../styles/training.webp"),
      capacity: "5+",
      amenities: ["Laptop", "WiFi"],
      floor: "Admin Reception Area",
      building: "Main Building",
      description: "...",
      rating: 4.3,
      reviews: 12,
      price: "Standard",
      size: "Small",
    },
    {
      id: 5,
      name: "Meeting Room 2",
      image: require("../styles/training.webp"),
      capacity: "5+",
      amenities: ["Laptop", "WiFi"],
      floor: "Admin Reception Area",
      building: "Main Building",
      description: "...",
      rating: 4.4,
      reviews: 10,
      price: "Standard",
      size: "Medium",
    },
  ];

  // Load favorites from localStorage
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  // Check room availability
  const isRoomAvailable = (roomName) => {
    if (!date) return true;
    const bookings = existingBookings.filter(
      (b) => b.room === roomName && b.date === date && b.status !== "cancelled",
    );
    return bookings.length === 0;
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const cardWidth = container.firstChild?.offsetWidth || 280;
    const scrollAmount = cardWidth + 16; // 16 is the gap (2*8)

    if (e.key === "ArrowLeft") {
      container.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    } else if (e.key === "ArrowRight") {
      container.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  // Arrow button click handlers
  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      const cardWidth =
        scrollContainerRef.current.firstChild?.offsetWidth || 280;
      scrollContainerRef.current.scrollBy({
        left: -(cardWidth + 16),
        behavior: "smooth",
      });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      const cardWidth =
        scrollContainerRef.current.firstChild?.offsetWidth || 280;
      scrollContainerRef.current.scrollBy({
        left: cardWidth + 16,
        behavior: "smooth",
      });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          overflow: "hidden",
          maxHeight: "90vh",
          bgcolor: "#f8f9fe",
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          p: 3,
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h5" fontWeight="bold">
              <MeetingRoomIcon sx={{ mr: 1, verticalAlign: "middle" }} />
              Select Meeting Room
            </Typography>
          </Box>
          <Box display="flex" gap={1} alignItems="center">
            {date && (
              <Chip
                label={`${new Date(date).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}`}
                sx={{
                  bgcolor: "rgba(255,255,255,0.2)",
                  color: "white",
                  fontWeight: "bold",
                }}
                size="small"
              />
            )}
            
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {/* Results count */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography variant="body2" color="textSecondary">
            Showing {rooms.length} rooms
          </Typography>
          {!date && (
            <Chip
              icon={<InfoIcon />}
              label="Select a date first to see availability"
              color="info"
              variant="outlined"
              size="small"
            />
          )}
        </Box>

        {/* Navigation arrows and scrollable cards */}
        <Box display="flex" alignItems="center" sx={{ position: "relative" }}>
          {/* Left arrow */}
          <IconButton
            onClick={scrollLeft}
            sx={{ mr: 1, bgcolor: "white", boxShadow: 2, zIndex: 1 }}
          >
            <ChevronLeftIcon />
          </IconButton>

          {/* Horizontal scrollable row – exactly 3 cards visible */}
          <Box
            ref={scrollContainerRef}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            sx={{
              display: "flex",
              flexDirection: "row",
              gap: 2,
              overflowX: "auto",
              overflowY: "hidden",
              scrollSnapType: "x mandatory",

              // Hide scrollbar
              scrollbarWidth: "none", // Firefox
              "&::-webkit-scrollbar": { display: "none" }, // Chrome, Safari, Edge

              // Add space below cards (gap between cards and hidden scrollbar area)
              pb: 2, // adjust as needed for desired gap

              "& > *": {
                scrollSnapAlign: "start",
                flex: "0 0 calc((100% - 2 * 16px) / 3)",
              },
            }}
          >
            {loading
              ? [...Array(5)].map((_, i) => (
                  <Box key={i}>
                    <Card>
                      <Skeleton variant="rectangular" height={180} />
                      <CardContent>
                        <Skeleton variant="text" width="80%" />
                        <Skeleton variant="text" width="60%" />
                        <Skeleton variant="text" width="40%" />
                      </CardContent>
                    </Card>
                  </Box>
                ))
              : rooms.map((room) => (
                  <Box key={room.id}>
                    <Zoom in={true} style={{ transitionDelay: "100ms" }}>
                      <Card
                        elevation={selectedRoom === room.name ? 8 : 2}
                        sx={{
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                          position: "relative",
                          "&:hover": {
                            transform: "translateY(-4px)",
                            boxShadow: "0 8px 30px rgba(108, 99, 255, 0.2)",
                          },
                          border:
                            selectedRoom === room.name
                              ? "3px solid #6C63FF"
                              : "2px solid transparent",
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          onSelectRoom(room.name);
                          onClose();
                        }}
                      >
                        {/* Availability Badge */}
                        {date && (
                          <Badge
                            badgeContent={
                              isRoomAvailable(room.name)
                                ? "Available"
                                : "Booked"
                            }
                            color={
                              isRoomAvailable(room.name) ? "success" : "error"
                            }
                            sx={{
                              position: "absolute",
                              top: 15,
                              left: 40,
                              zIndex: 2,
                              "& .MuiBadge-badge": {
                                fontSize: "0.65rem",
                                fontWeight: "bold",
                                px: 1,
                              },
                            }}
                          />
                        )}

                        <CardMedia
                          component="img"
                          height="180"
                          image={room.image}
                          alt={room.name}
                          sx={{
                            transition: "transform 0.5s ease",
                            "&:hover": {
                              transform: "scale(1.05)",
                            },
                          }}
                        />
                        <CardContent sx={{ flex: 1, p: 2.5 }}>
                          <Typography
                            variant="h6"
                            fontWeight="bold"
                            gutterBottom
                            fontSize="1rem"
                          >
                            {room.name}
                          </Typography>

                          {/* Room info chips */}
                          <Box
                            display="flex"
                            gap={0.5}
                            mb={1.5}
                            flexWrap="wrap"
                          >
                            <Chip
                              icon={<PeopleIcon sx={{ fontSize: 14 }} />}
                              label={`${room.capacity}`}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: "0.7rem", height: 24 }}
                            />
                            <Chip
                              icon={<MeetingRoomIcon sx={{ fontSize: 14 }} />}
                              label={room.floor}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: "0.7rem", height: 24 }}
                            />
                          </Box>

                          {/* Amenities */}
                          <Box display="flex" flexWrap="wrap" gap={0.5}>
                            {room.amenities.slice(0, 3).map((amenity) => (
                              <Chip
                                key={amenity}
                                label={amenity}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: "0.65rem", height: 22 }}
                              />
                            ))}
                            {room.amenities.length > 3 && (
                              <Tooltip
                                title={room.amenities.slice(3).join(", ")}
                              >
                                <Chip
                                  label={`+${room.amenities.length - 3}`}
                                  size="small"
                                  variant="outlined"
                                  sx={{
                                    fontSize: "0.65rem",
                                    height: 22,
                                    cursor: "help",
                                  }}
                                />
                              </Tooltip>
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                    </Zoom>
                  </Box>
                ))}
          </Box>

          {/* Right arrow */}
          <IconButton
            onClick={scrollRight}
            sx={{ ml: 1, bgcolor: "white", boxShadow: 2, zIndex: 1 }}
          >
            <ChevronRightIcon />
          </IconButton>
        </Box>

        {/* Empty state (fallback) */}
        {!loading && rooms.length === 0 && (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            py={6}
            sx={{ opacity: 0.7 }}
          >
            <MeetingRoomIcon
              sx={{ fontSize: 60, color: "text.secondary", mb: 2 }}
            />
            <Typography variant="h6" color="textSecondary" gutterBottom>
              No rooms found
            </Typography>
            <Typography variant="body2" color="textSecondary">
              No rooms available at the moment.
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          p: 3,
          borderTop: "1px solid",
          borderColor: "divider",
          bgcolor: "white",
        }}
      >
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        {selectedRoom && (
          <Button
            onClick={onClose}
            variant="contained"
            sx={{
              background: "linear-gradient(45deg, #6C63FF 30%, #FF6584 90%)",
              "&:hover": {
                background: "linear-gradient(45deg, #5A52E0 30%, #E55A75 90%)",
              },
            }}
          >
            Confirm: {selectedRoom}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default RoomSelectionModal;
