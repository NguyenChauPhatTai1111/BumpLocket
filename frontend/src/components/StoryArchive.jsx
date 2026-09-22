import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Clock3, Trash2 } from "lucide-react";
import { api, message } from "../api";
import { useSession } from "../store";

function ArchiveCard({ story }) {
    const tell = useSession((s) => s.tell), client = useQueryClient(), [image, setImage] = useState("");
    useEffect(() => {
        let active = true, objectUrl;
        if (story.has_image) api.get(`/stories/${story.id}/image`, { responseType: "blob" }).then((r) => { objectUrl = URL.createObjectURL(r.data); if (active) setImage(objectUrl); else URL.revokeObjectURL(objectUrl); }).catch(() => {});
        return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [story.id, story.has_image]);
    async function remove() { if (!confirm("Xóa tin này khỏi kho lưu trữ?")) return; try { await api.delete(`/stories/${story.id}`); client.invalidateQueries({ queryKey: ["story-archive"] }); } catch (e) { tell(message(e)); } }
    return <article className="archive-card">
        <div className="archive-preview" style={{ backgroundColor: story.background_color }}>{image && <img src={image} alt="" />}{!image && <p>{story.caption || "Tin có nhạc"}</p>}</div>
        <div className="archive-card-body"><div><b>{new Date(story.created_at).toLocaleDateString("vi-VN")}</b><small><Clock3 size={12} /> {story.is_expired ? "Đã hết hạn" : "Đang hiển thị"}</small></div><button className="icon delete" onClick={remove} aria-label="Xóa tin"><Trash2 size={15} /></button></div>
        {story.caption && image && <p className="archive-caption">{story.caption}</p>}
        {story.music_name && <small className="archive-music">♫ {story.music_name}</small>}
    </article>;
}

export default function StoryArchive() {
    const { data, isPending } = useQuery({ queryKey: ["story-archive"], queryFn: () => api.get("/stories/archive").then((r) => r.data) });
    if (isPending) return <div className="panel">Đang mở kho lưu trữ…</div>;
    return <section className="panel story-archive"><div className="section-title"><h2><Archive size={18} /> Kho lưu trữ Tin</h2><span className="muted">Tin của bạn được giữ lại</span></div>{!data?.data?.length ? <div className="empty compact"><Archive /><p>Những Tin hết 24 giờ sẽ tự động xuất hiện ở đây.</p></div> : <div className="archive-grid">{data.data.map((story) => <ArchiveCard key={story.id} story={story} />)}</div>}</section>;
}
