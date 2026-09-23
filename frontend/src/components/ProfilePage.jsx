import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, LockKeyhole, Send, Upload } from "lucide-react";
import { api, message } from "../api";
import { useSession } from "../store";
import { Avatar } from "./FriendList";
import MomentFeed from "./MomentFeed";
import StoryArchive from "./StoryArchive";

export default function ProfilePage() {
    const tell = useSession((s) => s.tell), setUser = useSession((s) => s.setUser), sessionUser = useSession((s) => s.user), client = useQueryClient();
    const draftKey = `bumplocket_post_draft_${sessionUser?.id || "guest"}`;
    const [name, setName] = useState(""), [avatar, setAvatar] = useState(null), [caption, setCaption] = useState(() => localStorage.getItem(draftKey) || ""), [image, setImage] = useState(null), [preview, setPreview] = useState("");
    const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => api.get("/profile").then((r) => r.data) });
    useEffect(() => { if (profile) setName(profile.name); }, [profile?.name]);
    useEffect(() => { if (caption) localStorage.setItem(draftKey, caption); else localStorage.removeItem(draftKey); }, [caption, draftKey]);
    useEffect(() => { if (!image) { setPreview(""); return; } const url = URL.createObjectURL(image); setPreview(url); return () => URL.revokeObjectURL(url); }, [image]);
    const update = useMutation({
        mutationFn: async () => { const body = new FormData(); body.append("name", name); if (avatar) body.append("avatar", avatar); return api.post("/profile", body); },
        onSuccess: ({ data }) => { setAvatar(null); setUser(data); client.invalidateQueries({ queryKey: ["profile"] }); client.invalidateQueries({ queryKey: ["friends"] }); client.invalidateQueries({ queryKey: ["moments"] }); client.invalidateQueries({ queryKey: ["profile-moments"] }); tell("Đã cập nhật trang cá nhân."); },
        onError: (error) => tell(message(error)),
    });
    const post = useMutation({
        mutationFn: async () => { const body = new FormData(); if (caption.trim()) body.append("caption", caption.trim()); if (image) body.append("image", image); return api.post("/moments", body); },
        onSuccess: () => { setCaption(""); setImage(null); localStorage.removeItem(draftKey); client.invalidateQueries({ queryKey: ["moments"] }); client.invalidateQueries({ queryKey: ["profile-moments"] }); tell("Đã đăng bài viết."); },
        onError: (error) => tell(message(error)),
    });
    if (!profile) return <div className="panel">Đang mở trang cá nhân…</div>;
    return <div className="profile-page">
        <section className="panel profile-header">
            <Avatar user={profile} name={profile.name} />
            <div><h2>{profile.name}</h2><p>{profile.email || profile.phone}</p></div>
            <form onSubmit={(e) => { e.preventDefault(); update.mutate(); }}>
                <input required maxLength="80" value={name} onChange={(e) => setName(e.target.value)} aria-label="Tên hiển thị" />
                <label className="file-picker"><Upload size={17} /> {avatar ? avatar.name : "Đổi ảnh đại diện"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setAvatar(e.target.files?.[0] || null)} /></label>
                <button className="primary" disabled={update.isPending}>{update.isPending ? "Đang lưu…" : "Cập nhật"}</button>
            </form>
        </section>
        <ChangePasswordPanel />
        <section className="panel post-composer">
            <div className="inline"><Avatar small user={profile} name={profile.name} /><b>Chia sẻ điều gì đó</b></div>
            <textarea maxLength="500" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Bạn đang nghĩ gì?" />
            {preview && <div className="selected-image"><img src={preview} alt="Ảnh đã chọn" /><button onClick={() => setImage(null)}>Bỏ ảnh</button></div>}
            <div className="composer-actions"><label className="file-picker"><ImagePlus size={18} /> Thêm ảnh<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImage(e.target.files?.[0] || null)} /></label><button className="primary" disabled={post.isPending || (!caption.trim() && !image)} onClick={() => post.mutate()}><Send size={17} /> {post.isPending ? "Đang đăng…" : "Đăng bài"}</button></div>
        </section>
        <StoryArchive />
        <div className="section-title"><h2>Bài viết của bạn</h2></div><MomentFeed mine />
    </div>;
}

export function ChangePasswordPanel() {
    const tell = useSession((s) => s.tell);
    const [passwords, setPasswords] = useState({ current_password: "", password: "", password_confirmation: "" });
    const changePassword = useMutation({
        mutationFn: () => api.put("/profile/password", passwords),
        onSuccess: () => { setPasswords({ current_password: "", password: "", password_confirmation: "" }); tell("Đã đổi mật khẩu."); },
        onError: (error) => tell(message(error)),
    });

    return <section className="panel password-panel">
        <div className="password-heading"><LockKeyhole size={22} /><div><h2>Đổi mật khẩu</h2><p>Dùng ít nhất 10 ký tự để bảo vệ tài khoản tốt hơn.</p></div></div>
        <form onSubmit={(e) => { e.preventDefault(); changePassword.mutate(); }}>
            <label>Mật khẩu hiện tại<input required maxLength="128" type="password" autoComplete="current-password" value={passwords.current_password} onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })} /></label>
            <label>Mật khẩu mới<input required minLength="10" maxLength="128" type="password" autoComplete="new-password" value={passwords.password} onChange={(e) => setPasswords({ ...passwords, password: e.target.value })} /></label>
            <label>Nhập lại mật khẩu mới<input required minLength="10" maxLength="128" type="password" autoComplete="new-password" value={passwords.password_confirmation} onChange={(e) => setPasswords({ ...passwords, password_confirmation: e.target.value })} /></label>
            <button className="primary" disabled={changePassword.isPending}>{changePassword.isPending ? "Đang đổi…" : "Đổi mật khẩu"}</button>
        </form>
    </section>;
}
