import axios from 'axios';

const api = axios.create({
    baseURL: "http://localhost/firstapp/php-backend/api", // ← ADDED /firstapp/
    headers: {
        "Content-Type": "application/json"
    }
});

// Add request interceptor for authentication
api.interceptors.request.use(
    (config) => {
        const token = sessionStorage.getItem("token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;