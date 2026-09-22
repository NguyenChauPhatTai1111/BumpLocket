import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Users } from "lucide-react";
import { api, message } from "../api";
import { useSession } from "../store";
import BumpButton from "./BumpButton";
export function Avatar({ name = "", small = false, user }) {
    const [src, setSrc] = useState("");
    useEffect(() => {
        let active = true, objectUrl;
        if (!user?.id || !user?.has_avatar) { setSrc(""); return; }
        api.get(`/users/${user.id}/avatar`, { responseType: "blob" }).then((response) => {
            objectUrl = URL.createObjectURL(response.data);
            if (active) setSrc(objectUrl); else URL.revokeObjectURL(objectUrl);
        }).catch(() => active && setSrc(""));
        return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [user?.id, user?.has_avatar, user?.avatar_updated_at]);
    return (
        <span className={"avatar " + (small ? "small" : "")}>
            {src ? <img src={src} alt={name || user?.name || "Ảnh đại diện"} /> : (name || user?.name || "").trim().slice(0, 2).toUpperCase() || "BL"}
        </span>
    );
}
export default function FriendList({ compact = false }) {
    const user = useSession((s) => s.user),
        tell = useSession((s) => s.tell);
    const q = useQueryClient();
    const [contact, setContact] = useState(""),
        [busy, setBusy] = useState(false);
    const {
        data: friends = [],
        isPending,
        error,
    } = useQuery({
        queryKey: ["friends"],
        queryFn: () => api.get("/friends").then((r) => r.data),
        refetchInterval: 15000,
    });
    async function invite(e) {
        e.preventDefault();
        setBusy(true);
        try {
            await api.post("/friends", { contact });
            setContact("");
            q.invalidateQueries({ queryKey: ["friends"] });
            tell("Đã gửi lời mời kết bạn.");
        } catch (e) {
            tell(message(e));
        } finally {
            setBusy(false);
        }
    }
    async function action(id, action) {
        try {
            await api.patch("/friends/" + id, { action });
            q.invalidateQueries();
        } catch (e) {
            tell(message(e));
        }
    }
    const accepted = friends.filter((f) => f.status === "accepted");
    function presence(friend) {
        if (friend.is_online) return "Đang online";
        if (!friend.last_seen_at) return "Đang offline";
        const seconds = Math.max(0, Math.floor((Date.now() - new Date(friend.last_seen_at)) / 1000));
        if (seconds < 60) return "Vừa hoạt động";
        if (seconds < 3600) return `Hoạt động ${Math.floor(seconds / 60)} phút trước`;
        if (seconds < 86400) return `Hoạt động ${Math.floor(seconds / 3600)} giờ trước`;
        return `Hoạt động ${Math.floor(seconds / 86400)} ngày trước`;
    }
    return (
        <section className="panel friends">
            <div className="section-title">
                <h2>
                    {compact ? "Bạn bè của bạn" : "Cùng nhau, gần hơn"}{" "}
                    <span>{accepted.length}</span>
                </h2>
                <Users size={18} />
            </div>
            {!compact && (
                <>
                    <p className="muted">
                        Kết nối bằng email hoặc số điện thoại đã đăng ký.
                    </p>
                    <form className="inline" onSubmit={invite}>
                        <input
                            required
                            placeholder="Email hoặc số điện thoại"
                            value={contact}
                            onChange={(e) => setContact(e.target.value)}
                        />
                        <button className="primary" disabled={busy}>
                            <UserPlus size={18} /> Mời
                        </button>
                    </form>
                </>
            )}
            {isPending && <p>Đang tải bạn bè…</p>}
            {error && <p role="alert">{message(error)}</p>}
            {!compact &&
                friends
                    .filter((f) => f.status === "pending")
                    .map((f) => (
                        <div className="friend" key={f.id}>
                            <Avatar
                                name={
                                    (f.user_id === user.id
                                        ? f.recipient
                                        : f.sender
                                    ).name
                                }
                            />
                            <div>
                                <b>
                                    {
                                        (f.user_id === user.id
                                            ? f.recipient
                                            : f.sender
                                        ).name
                                    }
                                </b>
                                <small>
                                    {f.user_id === user.id
                                        ? "Đang chờ đồng ý"
                                        : "Muốn kết bạn với bạn"}
                                </small>
                            </div>
                            {f.friend_id === user.id && (
                                <>
                                    <button
                                        onClick={() => action(f.id, "accept")}
                                    >
                                        Đồng ý
                                    </button>
                                    <button
                                        onClick={() => action(f.id, "reject")}
                                    >
                                        Từ chối
                                    </button>
                                </>
                            )}
                        </div>
                    ))}
            {accepted.map((f) => {
                const friend = f.user_id === user.id ? f.recipient : f.sender;
                return (
                    <div className="friend" key={f.id}>
                        <span className="presence-avatar"><Avatar name={friend.name} user={friend} /><i className={friend.is_online ? "online" : "offline"} /></span>
                        <div>
                            <b>{friend.name}</b>
                            <small className={friend.is_online ? "presence-text online" : "presence-text"}>{presence(friend)}</small>
                        </div>
                        <BumpButton friend={friend} />
                        {!compact && (
                            <button
                                className="text danger"
                                onClick={() => {
                                    if (
                                        confirm(
                                            "Chặn bạn này và dừng mọi phiên chia sẻ?",
                                        )
                                    )
                                        action(f.id, "block");
                                }}
                            >
                                Chặn
                            </button>
                        )}
                    </div>
                );
            })}
            {!isPending && !accepted.length && (
                <div className="empty compact">
                    <Users />
                    <p>
                        Mời người thân của bạn.
                        <br />
                        Khoảnh khắc sẽ vui hơn khi có nhau.
                    </p>
                </div>
            )}
        </section>
    );
}
