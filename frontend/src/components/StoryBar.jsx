import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ImagePlus, Link2, Plus, Trash2, X } from "lucide-react";
import { api, message } from "../api";
import { useSession } from "../store";
import { Avatar } from "./FriendList";

function youtubeId(value) {
    try {
        const url = new URL(value);
        if (url.hostname === "youtu.be") return url.pathname.slice(1).split("/")[0];
        if (["youtube.com", "www.youtube.com", "music.youtube.com"].includes(url.hostname)) {
            if (url.pathname === "/watch") return url.searchParams.get("v");
            if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/")) return url.pathname.split("/")[2];
        }
    } catch {}
    return "";
}

function storyDuration(story) {
    const parts = String(story?.music_id || "").split(":");
    if (parts[0] === "youtube" && Number(parts[3]) > Number(parts[2])) return Math.min(600, Math.max(1, Number(parts[3]) - Number(parts[2])));
    return 10;
}

function StoryViewer({ stories, initial, onClose }) {
    const [index, setIndex] = useState(initial);
    const [image, setImage] = useState("");
    const [reaction, setReaction] = useState(null), [reactionCounts, setReactionCounts] = useState({});
    const story = stories[index], me = useSession((s) => s.user), tell = useSession((s) => s.tell), client = useQueryClient();
    useEffect(() => { setReaction(story?.my_reaction || null); setReactionCounts(story?.reaction_counts || {}); }, [story?.id]);
    useEffect(() => {
        let active = true, objectUrl;
        setImage("");
        if (story?.has_image) api.get(`/stories/${story.id}/image`, { responseType: "blob" }).then((response) => { objectUrl = URL.createObjectURL(response.data); if (active) setImage(objectUrl); else URL.revokeObjectURL(objectUrl); }).catch(() => {});
        return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [story?.id]);
    const duration = storyDuration(story);
    useEffect(() => { const timer = setTimeout(() => index < stories.length - 1 ? setIndex(index + 1) : onClose(), duration * 1000); return () => clearTimeout(timer); }, [index, stories.length, duration]);
    async function remove() { if (!confirm("Xóa tin này?")) return; try { await api.delete(`/stories/${story.id}`); client.invalidateQueries({ queryKey: ["stories"] }); onClose(); } catch (e) { tell(message(e)); } }
    async function react(value) {
        try {
            if (reaction === value) { await api.delete(`/stories/${story.id}/reaction`); setReaction(null); setReactionCounts((counts) => ({ ...counts, [value]: Math.max(0, Number(counts[value] || 0) - 1) })); }
            else { await api.put(`/stories/${story.id}/reaction`, { reaction: value }); setReactionCounts((counts) => { const next = { ...counts }; if (reaction) next[reaction] = Math.max(0, Number(next[reaction] || 0) - 1); next[value] = Number(next[value] || 0) + 1; return next; }); setReaction(value); }
            client.invalidateQueries({ queryKey: ["stories"] });
        } catch (e) { tell(message(e)); }
    }
    if (!story) return null;
    return <div className="story-overlay" role="dialog" aria-modal="true"><div className="story-viewer" style={{ backgroundColor: story.background_color, "--story-duration": `${duration}s` }}>
        {image && <img className="story-full-image" src={image} alt={story.caption || "Tin của " + story.user.name} />}
        <div className="story-progress"><i key={story.id} /></div>
        <header><Avatar small user={story.user} name={story.user.name} /><div><b>{story.user.name}</b><small>Hiển thị trong 24 giờ</small></div>{story.user_id === me.id && <button onClick={remove} aria-label="Xóa tin"><Trash2 size={17} /></button>}<button onClick={onClose} aria-label="Đóng"><X size={20} /></button></header>
        {story.caption && <p className="story-caption">{story.caption}</p>}
        {story.music_audio_url && <div className="story-youtube"><iframe src={story.music_audio_url} title="Nhạc YouTube" allow="autoplay; encrypted-media" /></div>}
        {story.music_audio_url && <div className="story-music-label">♫ Đang phát đoạn nhạc đã chọn</div>}
        {story.music_share_url && <a className="music-credit" href={story.music_share_url} target="_blank" rel="noreferrer">Mở nhạc trên YouTube</a>}
        <div className="story-reactions">{[["like", "❤️"], ["haha", "😂"], ["angry", "😡"], ["care", "🥰"]].map(([value, emoji]) => <button key={value} className={reaction === value ? "chosen" : ""} onClick={() => react(value)}>{emoji}<small>{reactionCounts[value] || 0}</small></button>)}</div>
        <button className="story-prev" disabled={index === 0} onClick={() => setIndex(index - 1)} aria-label="Tin trước"><ChevronLeft /></button><button className="story-next" disabled={index === stories.length - 1} onClick={() => setIndex(index + 1)} aria-label="Tin sau"><ChevronRight /></button>
    </div></div>;
}

export default function StoryBar() {
    const me = useSession((s) => s.user), tell = useSession((s) => s.tell), client = useQueryClient();
    const [creating, setCreating] = useState(false), [viewer, setViewer] = useState(null), [caption, setCaption] = useState(""), [image, setImage] = useState(null), [color, setColor] = useState("#31472b"), [youtube, setYoutube] = useState(""), [start, setStart] = useState(0), [end, setEnd] = useState(30), [preview, setPreview] = useState(false);
    const { data: stories = [] } = useQuery({ queryKey: ["stories"], queryFn: () => api.get("/stories").then((r) => r.data), refetchInterval: 30000 });
    const create = useMutation({ mutationFn: async () => { const videoId = youtubeId(youtube); const clipStart = Math.max(0, Number(start) || 0), clipEnd = Math.max(clipStart + 1, Number(end) || 30); const body = new FormData(); if (caption.trim()) body.append("caption", caption.trim()); if (image) body.append("image", image); body.append("background_color", color); if (videoId) { body.append("music_id", `youtube:${videoId}:${clipStart}:${clipEnd}`); body.append("music_name", `Nhạc YouTube · ${clipStart}s–${clipEnd}s`); body.append("music_artist", "YouTube"); body.append("music_audio_url", `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&rel=0&start=${clipStart}&end=${clipEnd}`); body.append("music_share_url", `https://www.youtube.com/watch?v=${videoId}&t=${clipStart}s`); } return api.post("/stories", body); }, onSuccess: () => { setCreating(false); setCaption(""); setImage(null); setYoutube(""); setStart(0); setEnd(30); client.invalidateQueries({ queryKey: ["stories"] }); tell("Tin đã đăng và sẽ tự mất sau 24 giờ."); }, onError: (e) => tell(message(e)) });
    const previewId = youtubeId(youtube), previewUrl = previewId ? `https://www.youtube.com/embed/${previewId}?autoplay=1&controls=1&rel=0&start=${Math.max(0, Number(start) || 0)}&end=${Math.max((Number(start) || 0) + 1, Number(end) || 30)}` : "";
    return <>
        <section className="story-bar"><button className="story-add" onClick={() => setCreating(true)}><span><Avatar user={me} name={me.name} /><i><Plus size={15} /></i></span><b>Tạo tin</b><small>24 giờ</small></button>{stories.map((story, index) => <button className="story-tile" key={story.id} style={{ backgroundColor: story.background_color }} onClick={() => setViewer(index)}><Avatar user={story.user} name={story.user.name} /><span>{story.caption || (story.music_name ? "♫ Tin có nhạc" : "Một tin mới")}</span><b>{story.user.name}</b></button>)}</section>
        {creating && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="dialog story-create"><button className="dialog-close" onClick={() => setCreating(false)} aria-label="Đóng"><X /></button><p className="eyebrow">TIN TRONG 24 GIỜ</p><h2>Tạo tin mới</h2><textarea maxLength="500" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Chia sẻ điều gì đó…" /><div className="story-options"><label className="file-picker"><ImagePlus size={17} /> {image ? image.name : "Thêm ảnh"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImage(e.target.files?.[0] || null)} /></label><label>Màu nền<input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label></div><label className="youtube-input"><Link2 size={17} /> Link video YouTube<input value={youtube} onChange={(e) => { setYoutube(e.target.value); setPreview(false); }} placeholder="https://www.youtube.com/watch?v=..." /></label>{youtube && !previewId && <p className="error">Link YouTube chưa đúng định dạng.</p>}{youtube && previewId && <div className="clip-range"><label>Bắt đầu (giây)<input type="number" min="0" value={start} onChange={(e) => { setStart(e.target.value); setPreview(false); }} /></label><label>Kết thúc (giây)<input type="number" min="1" value={end} onChange={(e) => { setEnd(e.target.value); setPreview(false); }} /></label></div>}{previewId && <button type="button" className="preview-button" onClick={() => setPreview(!preview)}>{preview ? "Đóng nghe thử" : "▶ Nghe thử đoạn đã chọn"}</button>}{preview && <div className="preview-video"><iframe src={previewUrl} title="Nghe thử nhạc YouTube" allow="autoplay; encrypted-media" /></div>}<small className="music-note">Chỉ nhúng YouTube, không tải video. Chọn đoạn hay bằng thời điểm bắt đầu/kết thúc.</small><button className="primary full" disabled={create.isPending || (!caption.trim() && !image) || (youtube && !previewId)} onClick={() => create.mutate()}>{create.isPending ? "Đang đăng…" : "Chia sẻ tin trong 24 giờ"}</button></div></div>}
        {viewer !== null && <StoryViewer stories={stories} initial={viewer} onClose={() => setViewer(null)} />}
    </>;
}
