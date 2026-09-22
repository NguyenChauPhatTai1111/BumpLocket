import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, MessageCircle, Download, Camera, Trash2 } from "lucide-react";
import { api, message } from "../api";
import { useSession } from "../store";
import { Avatar } from "./FriendList";
function MomentCard({ moment }) {
    const [url, setUrl] = useState(""),
        [imageError, setImageError] = useState(""),
        [open, setOpen] = useState(false),
        [body, setBody] = useState("");
    const user = useSession((s) => s.user),
        tell = useSession((s) => s.tell),
        q = useQueryClient();
    useEffect(() => {
        let alive = true,
            objectUrl;
        if (!moment.has_image) { setUrl(""); setImageError(""); return; }
        api.get("/moments/" + moment.id + "/image", { responseType: "blob" })
            .then((r) => {
                objectUrl = URL.createObjectURL(r.data);
                if (alive) setUrl(objectUrl);
                else URL.revokeObjectURL(objectUrl);
            })
            .catch(() => alive && setImageError("Không thể tải ảnh."));
        return () => {
            alive = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [moment.id]);
    const { data: comments } = useQuery({
        queryKey: ["comments", moment.id],
        queryFn: () =>
            api.get("/moments/" + moment.id + "/comments").then((r) => r.data),
        enabled: open,
    });
    async function like() {
        try {
            await api[moment.liked ? "delete" : "put"](
                "/moments/" + moment.id + "/like",
            );
            q.invalidateQueries({ queryKey: ["moments"] });
        } catch (e) {
            tell(message(e));
        }
    }
    async function comment(e) {
        e.preventDefault();
        try {
            await api.post("/moments/" + moment.id + "/comments", { body });
            setBody("");
            q.invalidateQueries({ queryKey: ["comments", moment.id] });
            q.invalidateQueries({ queryKey: ["moments"] });
        } catch (e) {
            tell(message(e));
        }
    }
    async function remove() {
        if (!confirm("Xóa khoảnh khắc này?")) return;
        try {
            await api.delete("/moments/" + moment.id);
            q.invalidateQueries({ queryKey: ["moments"] });
        } catch (e) {
            tell(message(e));
        }
    }
    return (
        <article className={"moment-card " + (!moment.has_image ? "text-only" : "")}>
            {moment.has_image && <div className="moment-photo">
                {url ? (
                    <img
                        src={url}
                        alt={
                            moment.caption ||
                            "Khoảnh khắc của " + moment.user.name
                        }
                    />
                ) : (
                    <div className="photo-loading">
                        {imageError || "Đang tải ảnh…"}
                    </div>
                )}
                <span className="photo-time">
                    {new Date(moment.created_at).toLocaleDateString("vi-VN")}
                </span>
                {url && (
                    <a
                        className="download"
                        href={url}
                        download={"bumplocket-" + moment.id + ".jpg"}
                        aria-label="Tải ảnh"
                    >
                        <Download size={18} />
                    </a>
                )}
            </div>}
            <div className="moment-body">
                <div className="inline">
                    <Avatar small name={moment.user.name} user={moment.user} />
                    <b>{moment.user.name}</b>
                    {moment.user_id === user.id && (
                        <button
                            className="icon delete"
                            onClick={remove}
                            aria-label="Xóa ảnh"
                        >
                            <Trash2 size={15} />
                        </button>
                    )}
                </div>
                <p>{moment.caption || "Một khoảnh khắc muốn giữ lại."}</p>
                <div className="moment-actions">
                    <button
                        className={moment.liked ? "liked" : ""}
                        onClick={like}
                    >
                        <Heart
                            size={18}
                            fill={moment.liked ? "currentColor" : "none"}
                        />
                        {moment.likes_count}
                    </button>
                    <button onClick={() => setOpen(!open)}>
                        <MessageCircle size={18} />
                        {moment.comments_count}
                    </button>
                </div>
                {open && (
                    <div className="comments">
                        {comments?.data.map((c) => (
                            <p key={c.id}>
                                <b>{c.user.name}</b> {c.body}
                            </p>
                        ))}
                        <form className="inline" onSubmit={comment}>
                            <input
                                maxLength={500}
                                required
                                placeholder="Gửi một lời nhắn…"
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                            />
                            <button>Gửi</button>
                        </form>
                    </div>
                )}
            </div>
        </article>
    );
}
export default function MomentFeed({ mine = false }) {
    const [page, setPage] = useState(1);
    const setTab = useSession((s) => s.setTab);
    const { data, isPending, error } = useQuery({
        queryKey: [mine ? "profile-moments" : "moments", page],
        queryFn: () => api.get(`/moments?page=${page}${mine ? "&mine=1" : ""}`).then((r) => r.data),
    });
    if (isPending)
        return <div className="empty">Đang mở những khoảnh khắc…</div>;
    if (error) return <p role="alert">{message(error)}</p>;
    if (!data.data.length)
        return (
            <div className="empty feed-empty">
                <div className="empty-camera">
                    <Camera size={42} />
                </div>
                <h2>
                    Một ngày bình thường.
                    <br />
                    Một khoảnh khắc đặc biệt.
                </h2>
                <p>
                    Chụp tấm ảnh đầu tiên và chia sẻ với những người bạn yêu
                    quý.
                </p>
                <button className="primary" onClick={() => setTab(mine ? "profile" : "camera")}>
                    Chụp khoảnh khắc đầu tiên
                </button>
            </div>
        );
    return (
        <>
            <div className="moment-grid">
                {data.data.map((m) => (
                    <MomentCard key={m.id} moment={m} />
                ))}
            </div>
            <div className="pagination">
                <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                    Trước
                </button>
                <span>
                    {page} / {data.last_page}
                </span>
                <button
                    disabled={page >= data.last_page}
                    onClick={() => setPage(page + 1)}
                >
                    Sau
                </button>
            </div>
        </>
    );
}
