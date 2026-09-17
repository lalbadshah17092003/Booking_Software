import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Contact from "./pages/Contact";
import Dashboard from "./dashboard/Dashboard";
import CreateUser from "./admin/CreateUser";
import ForgotPassword from "./admin/ForgotPassword";
import UserList from "./admin/UserList";
import BookingForm from "./user/BookingForm";
import SuccessfulBooking from "./user/SuccessfullBooking";
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
        <Route path="/" element={<LandingPage/> }/>
        <Route path="/login" element={<Home />} />
      
        <Route path="/contact" element={<Contact />} />
        <Route path="*" element={<NotFound />} />
        <Route path="/forbidden" element={<Forbidden />} />
  
        {/* Public Booking Routes */}
        <Route
          path="/booking"
          element={
            <ProtectedRoute requiredRole={["Admin", "Hr", "User"]}>
              <BookingForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/checking"
          element={
            <ProtectedRoute requiredRole={["Admin", "Hr", "User"]}>
              <SuccessfulBooking />
            </ProtectedRoute>
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

