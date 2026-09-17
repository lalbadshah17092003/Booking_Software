import axios from "axios";

const api = axios.create({
  baseURL: `https://01-30225:1010/api`,
  withCredentials: true,
});

export default api;
