import axios from "axios";

const api = axios.create({
  baseURL: `https://192.168.0.150:5000/api`,
  withCredentials: true,
});

export default api;
