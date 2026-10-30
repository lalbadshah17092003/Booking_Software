import React, { useState } from "react";
import "./Contact.css";
import AddIcCallIcon from "@mui/icons-material/AddIcCall";
import AlternateEmailIcon from "@mui/icons-material/AlternateEmail";
import axios from "axios";

export default function Contact() {
  const [empName, setEmpName] = useState("");
  const [email, setEmail] = useState("");
  const [query, setQuery] = useState("");
  const [ExtensionNo, setExtensionNo] = useState("");
  const [ , setError] = useState("");
  const handleSubmit = async (e) => {
    e.preventDefault();
    // Validate the form fields
    if (!empName || !email || !query || !ExtensionNo) {
      setError("All fields are required!");
      return;
    }
    try {
      // Sending form data to the backend
      const response = await axios.post("https://192.168.0.150:5000/api/query", {
        empName,
        email,
        query,
        ExtensionNo
      });

      // Inform the user about the submission
      if (response.status === 200) {
        alert(
          "Your query has been submitted. You will receive a confirmation email."
        );
      }
    } catch (err) {
      setError(
        "There was an error with the submission. Please try again later."
      );
    }
  };

  return (
    <div className="contact-background">
      <div className="contact-content">
        <div className="contact-info">
          <div className="contact-item">
            <AddIcCallIcon /> Call
          </div>
          <br />
          <div>
            IT :- <b>251/2510</b>{" "}
          </div>
          <div>
            HR:- <b>252/212</b>
          </div>
          <div>
            Reception Table :-<b>9/447</b>
          </div>
          <br />
          <br />
          <div className="contact-item">
            <AlternateEmailIcon /> Email
          </div>
          <div>
            IT :- <br /> <b>helpdesk.it@apotheconpharma.com</b>
          </div>
          <div>
            HR:- <br />
            <b>hrd@apotheconpharma.com</b>
          </div>
          <div>
            Reception:- <br />
            <b>reception@apotheconpharma.com</b>
          </div>
        </div>
        <div className="contact-form">
          <form onSubmit={handleSubmit}>
            <h2 className="h22">Contact Us</h2>
            <table className="t1">
              <tbody>
                <th>
                  <tr>Name:</tr>
                  <tr>
                    <input
                      type="text"
                      name="name"
                      placeholder="Employee Name"
                      value={empName}
                      onChange={(e) => setEmpName(e.target.value)}
                    />
                  </tr>
                </th>
                <th>
                  <tr>Email:</tr>
                  <tr>
                    <input
                      type="email"
                      placeholder="Email"
                      name="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </tr>
                </th>
                <th>
                  <tr>Ext No:</tr>
                  <tr>
                    <input
                      type="text"
                      placeholder="Ext No"
                      name="ExtensionNo"
                      value={ExtensionNo}
                      onChange={(e) => setExtensionNo(e.target.value)}
                    />
                  </tr>
                </th>
                <tr>
                  <th>Message:</th>
                  <td>
                    <input
                      type="text"
                      placeholder="Query"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </td>
                </tr>
                <tr>
                  <td colSpan="2">
                    <button type="submit" className="cu">
                      Submit
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </form>
        </div>
      </div>
    </div>
  );
}
