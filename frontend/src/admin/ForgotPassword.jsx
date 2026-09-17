import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Select,
  MenuItem,
  Snackbar,
  Alert,
  Container,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Box,
  Typography,
  TablePagination,
} from "@mui/material";

const ForgotPassword = () => {
  const [employees, setEmployees] = useState([]);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [employeeIdError, setEmployeeIdError] = useState("");
  const [openEditDialog, setOpenEditDialog] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    employeeId: "",
    userRole: "",
    createdBy: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [openPasswordDialog, setOpenPasswordDialog] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("All");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await axios.get(
          "https://01-30225:1010/api/employees",
          {
            headers: {
              Authorization: `Bearer ${sessionStorage.getItem("token")}`,
            },
          }
        );
        setEmployees(response.data);
      } catch (err) {
        console.error("Error fetching employees", err);
        showSnackbar("Failed to fetch employees", "error");
      }
    };
    fetchEmployees();
  }, []);

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleOpenPasswordDialog = (employeeId) => {
    setFormData({
      employeeId: employeeId,
      newPassword: "",
      confirmPassword: "",
    });
    setOpenPasswordDialog(true);
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee._id);
    setFormData({
      name: employee.name,
      employeeId: employee.employeeId,
      userRole: employee.userRole,
      createdBy: employee.createdBy,
    });
    setOpenEditDialog(true);
  };

  const handleSaveEdit = async (id) => {
    try {
      const response = await axios.put(
        `https://01-30225:1010/api/employees/${id}`,
        formData
      );
      setEmployees((prev) =>
        prev.map((emp) => (emp._id === id ? response.data : emp))
      );
      setEditingEmployee(null);
      setFormData({ name: "", employeeId: "", userRole: "", createdBy: "" });
      showSnackbar("User details updated");
    } catch (err) {
      console.error("Error saving edit:", err);
      showSnackbar("Error updating user", "error");
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`https://01-30225:1010/api/employees/${id}`);
      setEmployees((prev) => prev.filter((emp) => emp._id !== id));
      showSnackbar("User deleted");
    } catch (err) {
      console.error("Error deleting employee:", err);
      showSnackbar("Error deleting user", "error");
    }
  };

  const handleChangePassword = async () => {
    if (formData.newPassword !== formData.confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    try {
      const response = await axios.put(
        `https://01-30225:1010/api/employees/${formData.employeeId}/change-password`,
        {
          newPassword: formData.newPassword,
          confirmPassword: formData.confirmPassword,
        },
        {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem("token")}`,
          },
        }
      );
      alert("Password updated successfully.");
      setOpenPasswordDialog(false);
      setFormData({
        employeeId: "",
        name: "",
        newPassword: "",
        confirmPassword: "",
      });
      setEmployees((prevState) =>
        prevState.map((emp) =>
          emp._id === response.data._id ? response.data : emp
        )
      );
    } catch (err) {
  console.error("Error changing password:", err);
  
  if (err.response?.data?.message?.includes("jwt expired")) {
    alert("Session expired. Please log in again.");
    sessionStorage.clear(); // or remove only the token
    window.location.href = "/login"; // redirect to login
  } else {
    alert("Error changing password.");
  }
}

  };

  // Search and filter logic
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.userRole.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = filterRole === "All" || emp.userRole === filterRole;
    return matchesSearch && matchesRole;
  });

  // Pagination logic
  const paginatedEmployees = filteredEmployees.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === "employeeId") {
      let newValue = value.toUpperCase(); // Always uppercase
      if (!newValue.startsWith("AP")) {
        newValue = "AP" + newValue.replace(/[^0-9]/g, "");
      } else {
        newValue = "AP" + newValue.slice(2).replace(/[^0-9]/g, "");
      }

      if (newValue.length > 6) return; // Limit total length to 6

      setFormData((prev) => ({ ...prev, [name]: newValue }));

      // Live validation
      if (/^AP\d{4}$/.test(newValue)) {
        setEmployeeIdError(""); // Valid
      } else {
        setEmployeeIdError(
          "Employee ID must be in the format AP followed by 4 digits."
        );
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  return (
    <Container sx={{ mt: 5 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom fontWeight="bold">
          Manage Users
        </Typography>

        {/* Search and Filter */}
        <Box display="flex" justifyContent="space-between" mb={2}>
          <TextField
            label="Search"
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ width: "60%" }}
          />
          <Select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            size="small"
            sx={{ width: "30%" }}
          >
            <MenuItem value="All">All Roles</MenuItem>
            <MenuItem value="Admin">Admin</MenuItem>
            <MenuItem value="Hr">HR</MenuItem>
            <MenuItem value="User">User</MenuItem>
          </Select>
        </Box>

        {/* Table */}
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Employee ID</TableCell>
              <TableCell>User Role</TableCell>
              <TableCell>Edit</TableCell>
              <TableCell>Delete</TableCell>
              <TableCell>Password</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedEmployees.map((employee) => (
              <TableRow key={employee._id}>
                <TableCell>{employee.name}</TableCell>
                <TableCell>{employee.employeeId}</TableCell>
                <TableCell>{employee.userRole}</TableCell>

                <TableCell>
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => handleEdit(employee)}
                  >
                    Edit
                  </Button>
                </TableCell>
                <TableCell>
                  <Button
                    variant="text"
                    size="small"
                    color="error"
                    onClick={() => handleDelete(employee._id)}
                  >
                    Delete
                  </Button>
                </TableCell>
                <TableCell>
                  <Button
  variant="outlined"
  size="small"
  onClick={() =>
    handleOpenPasswordDialog(employee._id) // FIXED: use _id
  }
>
  Change
</Button>

                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Pagination */}
        <TablePagination
          component="div"
          count={filteredEmployees.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Password Change Dialog */}
      <Dialog
        open={openPasswordDialog}
        onClose={() => setOpenPasswordDialog(false)}
      >
        <DialogTitle>Change Password</DialogTitle>
        <DialogTitle>
 {employees.find(emp => emp._id === formData.employeeId)?.name || ""}
</DialogTitle>

        <DialogContent  >
      
          <input
            type="password"
            placeholder="New Password"
            value={formData.newPassword}
            onChange={handleInputChange}
            name="newPassword"
            required
          />
          <br />
          <input
            type="password"
            placeholder="Confirm New Password"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            name="confirmPassword"
            required
          />
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpenPasswordDialog(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={handleChangePassword} color="primary">
            Change Password
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={openEditDialog}
        onClose={() => setOpenEditDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            label="Name"
            fullWidth
            name="name"
            value={formData.name}
            onChange={handleInputChange}
          />
          <TextField
            margin="dense"
            label="Employee ID"
            fullWidth
            name="employeeId"
            value={formData.employeeId}
            onChange={handleInputChange}
            helperText={
              employeeIdError ||
              "Format: AP followed by 4 digits (e.g., AP1234)"
            }
            error={Boolean(employeeIdError)}
            inputProps={{ maxLength: 6 }}
          />
          <Select
            fullWidth
            margin="dense"
            name="userRole"
            value={formData.userRole}
            onChange={handleInputChange}
            displayEmpty
          >
            <MenuItem value="">Select Role</MenuItem>
            <MenuItem value="Admin">Admin</MenuItem>
            <MenuItem value="Hr">HR</MenuItem>
            <MenuItem value="User">User</MenuItem>
          </Select>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditDialog(false)} color="primary">
            Cancel
          </Button>
          <Button
            onClick={() => {
              handleSaveEdit(editingEmployee);
              setOpenEditDialog(false);
            }}
            color="primary"
            disabled={Boolean(employeeIdError)}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={1010}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default ForgotPassword;
