import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Send } from "lucide-react";
import { api, message } from "../api";
import { useSession } from "../store";
import { Avatar } from "./FriendList";

export default function Messages() {
    const me = useSession((s) => s.user), tell = useSession((s) => s.tell), client = useQueryClient();
    const [selected, setSelected] = useState(null), [body, setBody] = useState(""), [sending, setSending] = useState(false);
    const end = useRef();
    const { data: conversations = [] } = useQuery({ queryKey: ["conversations"], queryFn: () => api.get("/messages").then((r) => r.data), refetchInterval: 5000 });
    const { data: messages = [] } = useQuery({ queryKey: ["messages", selected?.id], queryFn: () => api.get(`/messages/${selected.id}`).then((r) => r.data), enabled: Boolean(selected), refetchInterval: 3000 });
    useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, selected?.id]);
    async function send(e) {
        e.preventDefault(); if (!body.trim() || !selected) return; setSending(true);
        try { await api.post(`/messages/${selected.id}`, { body: body.trim() }); setBody(""); client.invalidateQueries({ queryKey: ["messages", selected.id] }); client.invalidateQueries({ queryKey: ["conversations"] }); }
        catch (error) { tell(message(error)); } finally { setSending(false); }
    }
    return <section className="messages-shell panel">
        <aside className="conversation-list"><h2>Tin nhắn</h2>{!conversations.length && <div className="empty compact"><MessageCircle /><p>Kết bạn để bắt đầu trò chuyện.</p></div>}{conversations.map(({ friend, latest_message, unread_count }) => <button key={friend.id} className={selected?.id === friend.id ? "selected" : ""} onClick={() => setSelected(friend)}><span className="presence-avatar"><Avatar user={friend} name={friend.name} /><i className={friend.is_online ? "online" : "offline"} /></span><span><b>{friend.name}</b><small>{latest_message?.body || "Bắt đầu trò chuyện"}</small></span>{unread_count > 0 && <i className="unread">{unread_count}</i>}</button>)}</aside>
        <div className="chat-panel">{selected ? <><header><Avatar user={selected} name={selected.name} /><div><b>{selected.name}</b><small>{selected.is_online ? "Đang online" : "Đang offline"}</small></div></header><div className="message-stream">{messages.map((item) => <div key={item.id} className={item.from_user_id === me.id ? "message mine" : "message"}><p>{item.body}</p><small>{new Date(item.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</small></div>)}<span ref={end} /></div><form onSubmit={send}><input maxLength="2000" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Nhập tin nhắn…" /><button className="primary" disabled={sending || !body.trim()} aria-label="Gửi"><Send size={18} /></button></form></> : <div className="chat-empty"><MessageCircle size={42} /><h2>Chọn một người bạn</h2><p>Tin nhắn chỉ dành cho hai bạn.</p></div>}</div>
    </section>;
}
