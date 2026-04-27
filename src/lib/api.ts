import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '/api',
});

// Axios Interceptor to attach Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Optional: Handle 401 errors globally
api.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    toast.error('Phiên đăng nhập hết hạn hoặc tài khoản đã thay đổi, vui lòng đăng nhập lại.');
    setTimeout(() => {
      window.location.href = '/';
    }, 1500);
  }
  return Promise.reject(error);
});

export default api;
