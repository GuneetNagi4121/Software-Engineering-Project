import axios from 'axios';

export const TOKEN_KEY = 'campuscycle_token';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

// Attach the JWT to every request when present.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalise errors into a consistent shape: { status, message, details }.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message =
      error.response?.data?.error ||
      error.message ||
      'Something went wrong. Please try again.';
    const details = error.response?.data?.details || null;
    return Promise.reject({ status, message, details });
  }
);

export default api;
