import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Contact from "./pages/Contact";
import Dashboard from "./dashboard/Dashboard";
import CreateUser from "./admin/CreateUser";
import ForgotPassword from "./admin/ForgotPassword";
import UserList from "./admin/UserList";
import FullList from "./admin/Booked/FullList";
import Approval from "./admin/Booked/Approval";
import NewPassword from "./components/NewPassword";
import NotFound from "./pages/NotFound";
import Forbidden from "./pages/Forbidden";
import ProtectedRoute from "./ProtectedRoute";
import "./App.css";
import LandingPage from "./Homepages/LandingPage";

function App() {
  return (
    <div className="App">
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Home />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="*" element={<NotFound />} />
        <Route path="/forbidden" element={<Forbidden />} />

        {/* Booking views open inside the dashboard sidebar layout. */}
        <Route
          path="/booking"
          element={
            <Navigate
              to="/dashboard"
              state={{ section: "conference", item: "booking" }}
              replace
            />
          }
        />
        <Route
          path="/checking"
          element={
            <Navigate
              to="/dashboard"
              state={{ section: "conference", item: "calendar" }}
              replace
            />
          }
        />
        <Route
          path="/my-meetings"
          element={
            <Navigate
              to="/dashboard"
              state={{ section: "conference", item: "calendar" }}
              replace
            />
          }
        />
        <Route
          path="/calendar"
          element={
            <Navigate
              to="/dashboard"
              state={{ section: "conference", item: "calendar" }}
              replace
            />
          }
        />

        {/* Protected Routes */}
        <Route
          path="/newpassword"
          element={
            <ProtectedRoute requiredRole={["Admin", "Hr", "User"]}>
              <NewPassword />
            </ProtectedRoute>
          }
        />
        <Route
          path="/forgot"
          element={
            <ProtectedRoute requiredRole={["Admin"]}>
              <ForgotPassword />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create"
          element={
            <ProtectedRoute requiredRole={["Admin"]}>
              <CreateUser />
            </ProtectedRoute>
          }
        />
        <Route
          path="/userlist"
          element={
            <ProtectedRoute requiredRole={["Admin"]}>
              <UserList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/approval"
          element={
            <ProtectedRoute requiredRole={["Admin", "Hr"]}>
              <Approval />
            </ProtectedRoute>
          }
        />
        <Route
          path="/fulllist"
          element={
            <ProtectedRoute requiredRole={["Admin", "Hr"]}>
              <FullList />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
