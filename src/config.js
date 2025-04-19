import axios from 'axios';

const BASE_URL = process.env.REACT_APP_BASE_URL || 'https://budget-app-ao5r.onrender.com';

// Add axios interceptor to include token in all requests
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, error => {
  return Promise.reject(error);
});

// Aggiungi log per debug
console.log('BASE_URL:', BASE_URL);

export default BASE_URL;
