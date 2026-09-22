import axios from "axios";
import { useSession } from "./store";
export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "/api",
    headers: { Accept: "application/json" },
});
api.interceptors.request.use((config) => {
    const token = useSession.getState().token;
    if (token) config.headers.Authorization = "Bearer " + token;
    return config;
});
api.interceptors.response.use(
    (r) => r,
    (error) => {
        if (error.response?.status === 401) useSession.getState().logout();
        return Promise.reject(error);
    },
);
export const message = (e) =>
    Object.values(e.response?.data?.errors || {}).flat()[0] ||
    e.response?.data?.message ||
    e.message ||
    "Không thể kết nối. Thử lại nhé.";
