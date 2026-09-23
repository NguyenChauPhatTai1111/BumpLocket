import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
    QueryClient,
    QueryClientProvider,
    useQuery,
} from "@tanstack/react-query";
import Echo from "laravel-echo";
import Pusher from "pusher-js";
import {
    Camera,
    Home,
    Users,
    MapPin,
    Bell,
    LogOut,
    ArrowUpRight,
    ShieldCheck,
    Radio,
    Plus,
    Heart,
    Sparkles,
    X,
    UserRound,
    MessagesSquare,
} from "lucide-react";
import { useSession } from "./store";
import { api, message } from "./api";
import { enablePush, disablePush, ring, unlockSound } from "./notifications";
import FriendList, { Avatar } from "./components/FriendList";
import MomentFeed from "./components/MomentFeed";
import CameraCapture from "./components/CameraCapture";
const LiveMapView = lazy(() => import("./components/LiveMapView"));
import ShakeToConfirmModal from "./components/ShakeToConfirmModal";
import AdminUsers from "./components/AdminUsers";
import ProfilePage from "./components/ProfilePage";
import Messages from "./components/Messages";
import StoryBar from "./components/StoryBar";
import "./styles.css";
const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
});
function Brand() {
    return (
        <div className="brand">
            <span className="brand-mark">
                b<span>°</span>
            </span>
            Bump<span>Locket</span>
            <i />
        </div>
    );
}
function Auth() {
    const resetParams = new URLSearchParams(window.location.search);
    const [screen, setScreen] = useState(resetParams.get("reset_token") ? "reset" : "login"),
        [form, setForm] = useState({
            name: "",
            login: resetParams.get("email") || "",
            password: "",
            password_confirmation: "",
            token: resetParams.get("reset_token") || "",
        }),
        [error, setError] = useState(""),
        [busy, setBusy] = useState(false);
    const session = useSession((s) => s.session);
    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
            if (screen === "forgot") {
                const { data } = await api.post("/auth/forgot-password", { email: form.login });
                setError(data.message);
                return;
            }
            if (screen === "reset") {
                const { data } = await api.post("/auth/reset-password", {
                    token: form.token,
                    email: form.login,
                    password: form.password,
                    password_confirmation: form.password_confirmation,
                });
                window.history.replaceState({}, "", window.location.pathname);
                setForm({ ...form, password: "", password_confirmation: "", token: "" });
                setScreen("login");
                setError(data.message + " Bạn có thể đăng nhập ngay.");
                return;
            }
            await unlockSound();
            const body = screen === "register"
                ? {
                      name: form.name,
                      [form.login.includes("@") ? "email" : "phone"]:
                          form.login,
                      password: form.password,
                      password_confirmation: form.password_confirmation,
                  }
                : { login: form.login, password: form.password };
            const { data } = await api.post(
                screen === "register" ? "/auth/register" : "/auth/login",
                body,
            );
            queryClient.clear();
            session(data.token, data.user);
        } catch (e) {
            setError(message(e));
        } finally {
            setBusy(false);
        }
    }
    return (
        <div className="auth-shell">
            <div className="auth-art">
                <Brand />
                <span className="eyebrow">
                    LITTLE MOMENTS. REAL CONNECTIONS.
                </span>
                <h1>
                    Xa một chút.
                    <br />
                    Gần <em>rất nhiều.</em>
                </h1>
                <p>
                    Một tấm ảnh bất chợt. Một lời hẹn gần đây.
                    <br />
                    Giữ những người bạn thương trong ngày của mình.
                </p>
                <div className="orbit">
                    <div className="orbit-ring" />
                    <div className="orbit-heart">
                        <Heart size={76} />
                    </div>
                    <span className="orbit-tag">
                        <Radio size={17} /> một Bump, gần nhau hơn
                    </span>
                    <span className="orbit-note">just us. right here. ✦</span>
                </div>
                <small>Chỉ chia sẻ vị trí khi cả hai cùng đồng ý.</small>
            </div>
            <div className="auth-form">
                <form onSubmit={submit}>
                    <p className="eyebrow">CHÀO BẠN, LẠI GẦN ĐÂY NÀO</p>
                    <h2>
                        {screen === "register"
                            ? "Một vòng bạn bè mới"
                            : screen === "forgot"
                              ? "Tìm lại mật khẩu."
                              : screen === "reset"
                                ? "Đặt mật khẩu mới."
                                : "Vui vì có bạn ở đây."}
                    </h2>
                    <p className="muted">
                        {screen === "register"
                            ? "Tạo tài khoản và mời những người bạn thân."
                            : screen === "forgot"
                              ? "Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết khôi phục."
                              : screen === "reset"
                                ? "Chọn mật khẩu mới có ít nhất 10 ký tự."
                                : "Đăng nhập để nối tiếp những khoảnh khắc."}
                    </p>
                    {screen === "register" && (
                        <label>
                            Tên của bạn
                            <input
                                required
                                maxLength={80}
                                autoComplete="name"
                                value={form.name}
                                onChange={(e) =>
                                    setForm({ ...form, name: e.target.value })
                                }
                            />
                        </label>
                    )}
                    <label>
                        {screen === "login" || screen === "register" ? "Email hoặc số điện thoại" : "Email"}
                        <input
                            required
                            type={screen === "forgot" || screen === "reset" ? "email" : "text"}
                            autoComplete={screen === "forgot" || screen === "reset" ? "email" : "username"}
                            value={form.login}
                            onChange={(e) =>
                                setForm({ ...form, login: e.target.value })
                            }
                            placeholder="ban@example.com"
                        />
                    </label>
                    {screen !== "forgot" && <label>
                        {screen === "reset" ? "Mật khẩu mới" : "Mật khẩu"}
                        <input
                            required
                            minLength={screen === "register" || screen === "reset" ? 10 : 1}
                            type="password"
                            autoComplete={
                                screen === "register" || screen === "reset" ? "new-password" : "current-password"
                            }
                            value={form.password}
                            onChange={(e) =>
                                setForm({ ...form, password: e.target.value })
                            }
                        />
                    </label>}
                    {(screen === "register" || screen === "reset") && (
                        <label>
                            Nhập lại mật khẩu
                            <input
                                required
                                minLength={10}
                                type="password"
                                autoComplete="new-password"
                                value={form.password_confirmation}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        password_confirmation: e.target.value,
                                    })
                                }
                            />
                        </label>
                    )}
                    {error && (
                        <p className={screen === "forgot" || error.includes("thành công") ? "auth-message" : "error"} role="alert">
                            {error}
                        </p>
                    )}
                    <button className="primary full" disabled={busy}>
                        {busy
                            ? "Chờ một chút…"
                            : screen === "register"
                              ? "Tạo tài khoản"
                              : screen === "forgot"
                                ? "Gửi liên kết khôi phục"
                                : screen === "reset"
                                  ? "Đặt lại mật khẩu"
                                  : "Vào BumpLocket"}{" "}
                        <ArrowUpRight size={18} />
                    </button>
                    {screen === "login" && <button
                        type="button"
                        className="text full forgot-link"
                        onClick={() => { setScreen("forgot"); setError(""); }}
                    >
                        Quên mật khẩu?
                    </button>}
                    <button
                        type="button"
                        className="text full"
                        onClick={() => {
                            setScreen(screen === "login" ? "register" : "login");
                            setError("");
                        }}
                    >
                        {screen === "register"
                            ? "Đã có tài khoản? Đăng nhập"
                            : screen === "login"
                              ? "Lần đầu ghé qua? Tạo tài khoản"
                              : "Quay lại đăng nhập"}
                    </button>
                    <div className="auth-privacy">
                        <ShieldCheck size={18} />
                        <p>
                            Ảnh dành cho bạn bè. Vị trí có thời hạn.
                            <br />
                            Quyền riêng tư luôn nằm trong tay bạn.
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
}
function Workspace() {
    const { user, token, tab, setTab: storeSetTab, tell } = useSession();
    const setTab = (nextTab) => {
        if (nextTab === tab) return;
        const update = () => storeSetTab(nextTab);
        if (document.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            document.startViewTransition(update);
        } else {
            update();
        }
    };
    const seen = useRef(new Set()),
        [realtime, setRealtime] = useState("Đang kết nối");
    const { data: bumps = [] } = useQuery({
        queryKey: ["bumps"],
        queryFn: () => api.get("/bumps").then((r) => r.data),
        refetchInterval: 5000,
    });
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);
    const current = bumps.filter((b) => new Date(b.expires_at).getTime() > now);
    const incoming = current.find(
        (b) => b.status === "pending" && b.to_user_id === user.id,
    );
    const active = current.filter((b) => b.status === "accepted");
    useEffect(() => {
        const heartbeat = () => api.post("/presence/online").catch(() => {});
        heartbeat();
        const timer = setInterval(heartbeat, 25000);
        return () => clearInterval(timer);
    }, [user.id]);
    useEffect(() => {
        if (incoming && !seen.current.has(incoming.id)) {
            seen.current.add(incoming.id);
            ring();
        }
    }, [incoming?.id]);
    useEffect(() => {
        const key = import.meta.env.VITE_REVERB_APP_KEY;
        if (!key || (location.protocol === 'https:' && import.meta.env.VITE_REVERB_SCHEME !== 'https')) {
            setRealtime("Đồng bộ mỗi 5 giây");
            return;
        }
        window.Pusher = Pusher;
        const echo = new Echo({
            broadcaster: "reverb",
            key,
            wsHost: import.meta.env.VITE_REVERB_HOST || location.hostname,
            wsPort: Number(import.meta.env.VITE_REVERB_PORT || 8080),
            wssPort: Number(import.meta.env.VITE_REVERB_PORT || 443),
            forceTLS: import.meta.env.VITE_REVERB_SCHEME === "https",
            enabledTransports: ["ws", "wss"],
            authorizer: (channel) => ({
                authorize: async (socketId, callback) => {
                    try {
                        const { data } = await api.post("/broadcasting/auth", {
                            socket_id: socketId,
                            channel_name: channel.name,
                        });
                        callback(null, data);
                    } catch (e) {
                        callback(e, null);
                    }
                },
            }),
        });
        echo.connector.pusher.connection.bind("connected", () =>
            setRealtime("Đã kết nối trực tiếp"),
        );
        echo.connector.pusher.connection.bind("unavailable", () =>
            setRealtime("Đồng bộ mỗi 5 giây"),
        );
        echo.connector.pusher.connection.bind("error", () =>
            setRealtime("Đồng bộ mỗi 5 giây"),
        );
        echo.private("user." + user.id)
            .listen(".BumpRequested", () =>
                queryClient.invalidateQueries({ queryKey: ["bumps"] }),
            )
            .listen(".LocationUpdated", (e) => {
                if (e.status !== "updated")
                    queryClient.removeQueries({
                        queryKey: ["locations", e.id],
                    });
                else
                    queryClient.invalidateQueries({
                        queryKey: ["locations", e.id],
                    });
                queryClient.invalidateQueries({ queryKey: ["bumps"] });
            });
        return () => echo.disconnect();
    }, [user.id, token]);
    useEffect(() => {
        const event = () =>
            queryClient.invalidateQueries({ queryKey: ["bumps"] });
        navigator.serviceWorker?.addEventListener("message", event);
        return () =>
            navigator.serviceWorker?.removeEventListener("message", event);
    }, []);
    async function logout() {
        try {
            for (const b of active) await api.delete("/bumps/" + b.id);
            await disablePush();
            await api.post("/presence/offline");
            await api.post("/auth/logout");
        } catch (e) {
            tell("Không thể hoàn tất đăng xuất an toàn: " + message(e));
            return;
        }
        queryClient.clear();
        useSession.getState().logout();
    }
    async function notifications() {
        try {
            await enablePush();
            tell("Đã bật thông báo cho BumpLocket.");
        } catch (e) {
            tell(message(e));
        }
    }
    const nav = [
        ["feed", Home, "Khoảnh khắc"],
        ["camera", Camera, "Chụp ảnh"],
        ["friends", Users, "Bạn bè"],
        ["messages", MessagesSquare, "Tin nhắn"],
        ["bump", MapPin, "Bump vị trí"],
        ["profile", UserRound, "Cá nhân"],
        ...(user.is_admin ? [["admin", ShieldCheck, "Quản trị"]] : []),
    ];
    return (
        <div className="app-shell">
            <aside className="sidebar">
                <Brand />
                <p className="nav-label">GÓC NHỎ CỦA BẠN</p>
                <nav>
                    {nav.map(([id, Icon, label]) => (
                        <button
                            key={id}
                            onClick={() => setTab(id)}
                            className={tab === id ? "selected" : ""}
                        >
                            <Icon size={20} />
                            {label}
                            {id === "bump" && active.length > 0 && (
                                <i>{active.length}</i>
                            )}
                        </button>
                    ))}
                </nav>
                <div className="sidebar-bottom">
                    <div className="privacy-card">
                        <ShieldCheck />
                        <b>Gần nhau, theo cách của bạn.</b>
                        <p>
                            Vị trí mặc định là riêng tư. Bạn luôn có quyền dừng
                            chia sẻ.
                        </p>
                    </div>
                    <button className="profile" onClick={() => setTab("profile")} title="Trang cá nhân">
                        <Avatar name={user.name} user={user} />
                        <span>
                            <b>{user.name}</b>
                            <small>Xem trang cá nhân</small>
                        </span>
                    </button>
                    <button className="text full" onClick={logout}><LogOut size={16} /> Đăng xuất</button>
                </div>
            </aside>
            <div className="workspace">
                <header className="topbar">
                    <span>
                        <span className="tiny-dot" /> {realtime}
                    </span>
                    <div>
                        <button
                            className="icon"
                            title="Bật thông báo"
                            onClick={notifications}
                        >
                            <Bell size={20} />
                        </button>
                        <button className="icon" onClick={() => setTab("profile")} title="Trang cá nhân"><Avatar small name={user.name} user={user} /></button>
                    </div>
                </header>
                <main>
                    <div className="page-heading">
                        <div>
                            <p className="eyebrow">
                                YOUR PEOPLE. YOUR LITTLE WORLD.
                            </p>
                            <h1>
                                {tab === "feed"
                                    ? "Những điều nhỏ, niềm vui to."
                                    : tab === "friends"
                                      ? "Những người ở gần trái tim."
                                      : tab === "messages"
                                        ? "Chuyện riêng của hai người."
                                        : tab === "profile"
                                          ? "Góc nhỏ của riêng bạn."
                                      : tab === "camera"
                                        ? "Hôm nay, qua mắt bạn."
                                        : tab === "admin"
                                          ? "Quản lý người dùng."
                                          : "Một Bump. Gần nhau hơn."}
                            </h1>
                            <p className="muted">
                                Xin chào {user.name.split(" ").at(-1)}.{" "}
                                {tab === "feed"
                                    ? "Hôm nay có gì muốn kể với bạn bè không?"
                                    : "Mọi kết nối đều bắt đầu bằng sự đồng ý."}
                            </p>
                        </div>
                        {tab !== "camera" && (
                            <button
                                className="primary"
                                onClick={() => setTab("camera")}
                            >
                                <Plus size={19} /> Khoảnh khắc mới
                            </button>
                        )}
                    </div>
                    <div className={"content-layout " + (["messages", "profile", "admin"].includes(tab) ? "wide-content" : "")}>
                        <div className="main-column">
                            {tab === "feed" && (
                                <>
                                    <StoryBar />
                                    <section className="hello-banner">
                                        <div>
                                            <span className="badge">
                                                CHIA SẺ MỘT CHÚT HÔM NAY
                                            </span>
                                            <h2>
                                                Đâu cần chuyện lớn.
                                                <br />
                                                Có bạn là đủ vui.
                                            </h2>
                                            <button
                                                onClick={() => setTab("camera")}
                                            >
                                                Bật camera, gửi yêu thương{" "}
                                                <ArrowUpRight size={17} />
                                            </button>
                                        </div>
                                        <div className="banner-graphic">
                                            <div className="mini-photo">
                                                <Camera size={52} />
                                                <span>
                                                    your day, unfiltered.
                                                </span>
                                            </div>
                                            <span className="spark">✦</span>
                                            <span className="love-bubble">
                                                <Heart size={25} />
                                            </span>
                                        </div>
                                    </section>
                                    <div className="section-title feed-title">
                                        <h2>
                                            Dòng khoảnh khắc{" "}
                                            <span>CHỈ BẠN BÈ</span>
                                        </h2>
                                        <span className="muted">Mới nhất</span>
                                    </div>
                                    <MomentFeed />
                                </>
                            )}
                            {tab === "camera" && <CameraCapture />}
                            {tab === "friends" && <FriendList />}
                            {tab === "messages" && <Messages />}
                            {tab === "profile" && <ProfilePage />}
                            {tab === "bump" && (
                                <>
                                    <div className="bump-intro panel">
                                        <Radio size={36} />
                                        <h2>Hẹn gặp một người bạn?</h2>
                                        <p>
                                            Chọn một người, gửi Bump. Chỉ sau
                                            khi bạn ấy đồng ý, cả hai mới có thể
                                            bật GPS và nhìn thấy nhau.
                                        </p>
                                    </div>
                                    <FriendList />
                                    {current
                                        .filter(
                                            (b) =>
                                                b.status === "pending" &&
                                                b.from_user_id === user.id,
                                        )
                                        .map((b) => (
                                            <div
                                                className="panel waiting"
                                                key={b.id}
                                            >
                                                <p>
                                                    Đang đợi {b.recipient.name}{" "}
                                                    · hết hạn sau{" "}
                                                    {Math.max(
                                                        0,
                                                        Math.ceil(
                                                            (new Date(
                                                                b.expires_at,
                                                            ) -
                                                                now) /
                                                                1000,
                                                        ),
                                                    )}{" "}
                                                    giây
                                                </p>
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            await api.delete(
                                                                "/bumps/" +
                                                                    b.id,
                                                            );
                                                            queryClient.invalidateQueries(
                                                                {
                                                                    queryKey: [
                                                                        "bumps",
                                                                    ],
                                                                },
                                                            );
                                                        } catch (e) {
                                                            tell(message(e));
                                                        }
                                                    }}
                                                >
                                                    Hủy lời mời
                                                </button>
                                            </div>
                                        ))}
                                </>
                            )}
                            {active.map((b) => (
                                <Suspense key={b.id} fallback={<div className="panel">Đang mở bản đồ…</div>}><LiveMapView bump={b} /></Suspense>
                            ))}
                            {tab === "admin" && <AdminUsers />}
                        </div>
                        {!(["messages", "profile", "admin"].includes(tab)) && <aside className="right-column">
                            <FriendList compact />
                            <section className="panel bump-promo">
                                <div className="bump-art">
                                    <MapPin size={43} />
                                    <span className="radar r1" />
                                    <span className="radar r2" />
                                </div>
                                <span className="badge">BUMP VỊ TRÍ</span>
                                <h2>
                                    “Bạn đang ở đâu?”
                                    <br />
                                    Hỏi bằng một Bump.
                                </h2>
                                <p>
                                    Gửi lời mời và chia sẻ vị trí tạm thời. Chỉ
                                    khi cả hai đồng ý.
                                </p>
                                <button
                                    className="dark full"
                                    onClick={() => setTab("bump")}
                                >
                                    Thử một Bump <ArrowUpRight size={17} />
                                </button>
                            </section>
                            <div className="side-note">
                                <Sparkles size={16} />
                                <p>
                                    Không có khoảng cách nào lớn hơn
                                    <br />
                                    một lời chào chưa gửi.
                                </p>
                            </div>
                        </aside>}
                    </div>
                    <div className="footer-note">
                        BumpLocket © 2026{" "}
                        <span>Made for your inner circle ♡</span>
                    </div>
                </main>
            </div>
            <nav className="mobile-nav">
                {nav.map(([id, Icon, label]) => (
                    <button
                        key={id}
                        className={tab === id ? "selected" : ""}
                        onClick={() => setTab(id)}
                    >
                        <Icon size={22} />
                        <small>{label}</small>
                    </button>
                ))}
            </nav>
            {incoming && (
                <ShakeToConfirmModal key={incoming.id} bump={incoming} />
            )}
        </div>
    );
}
function App() {
    const { token, user, setUser, notice, tell } = useSession();
    const [error, setError] = useState("");
    useEffect(() => {
        if (!token) return;
        let alive = true;
        api.get("/me")
            .then((r) => {
                if (alive) setUser(r.data);
            })
            .catch((e) => {
                if (alive) setError(message(e));
            });
        return () => {
            alive = false;
        };
    }, [token]);
    useEffect(() => {
        if (!notice) return;
        const t = setTimeout(() => tell(""), 6500);
        return () => clearTimeout(t);
    }, [notice]);
    return (
        <>
            {!token ? (
                <Auth />
            ) : !user ? (
                <div className="loading-screen">
                    <Brand />
                    <p>{error || "Đang kết nối với góc nhỏ của bạn…"}</p>
                    {error && (
                        <button onClick={() => useSession.getState().logout()}>
                            Về đăng nhập
                        </button>
                    )}
                </div>
            ) : (
                <Workspace />
            )}
            {notice && (
                <div className="toast" role="status">
                    {notice}
                    <button aria-label="Đóng" onClick={() => tell("")}>
                        <X size={18} />
                    </button>
                </div>
            )}
        </>
    );
}
if ("serviceWorker" in navigator)
    navigator.serviceWorker
        .register(import.meta.env.BASE_URL + "sw.js", {
            scope: import.meta.env.BASE_URL,
        })
        .catch(() => {});
createRoot(document.getElementById("root")).render(
    <QueryClientProvider client={queryClient}>
        <App />
    </QueryClientProvider>,
);
