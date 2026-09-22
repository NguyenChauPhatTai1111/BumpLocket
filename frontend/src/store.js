import { create } from "zustand";
export const useSession = create((set) => ({
    token: sessionStorage.getItem("bumplocket_token"),
    user: null,
    tab: "feed",
    notice: "",
    session: (token, user) => {
        sessionStorage.setItem("bumplocket_token", token);
        set({ token, user });
    },
    setUser: (user) => set({ user }),
    logout: () => {
        sessionStorage.removeItem("bumplocket_token");
        set({ token: null, user: null });
    },
    setTab: (tab) => set({ tab }),
    tell: (notice) => set({ notice }),
}));
