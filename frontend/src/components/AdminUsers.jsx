import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { api, message } from "../api";
import { useSession } from "../store";

const blank = { name: "", email: "", phone: "", password: "", is_admin: false };

export default function AdminUsers() {
    const me = useSession((state) => state.user), tell = useSession((state) => state.tell), client = useQueryClient();
    const [search, setSearch] = useState(""), [query, setQuery] = useState(""), [editing, setEditing] = useState(null), [form, setForm] = useState(blank);
    const { data, isLoading } = useQuery({ queryKey: ["admin-users", query], queryFn: () => api.get("/admin/users", { params: { search: query || undefined } }).then((r) => r.data) });
    const refresh = () => client.invalidateQueries({ queryKey: ["admin-users"] });
    const close = () => { setEditing(null); setForm(blank); };
    const save = useMutation({
        mutationFn: () => editing?.id ? api.put(`/admin/users/${editing.id}`, form) : api.post("/admin/users", form),
        onSuccess: () => { const changed = Boolean(editing?.id); refresh(); close(); tell(changed ? "Đã cập nhật tài khoản." : "Đã tạo tài khoản."); },
        onError: (error) => tell(message(error)),
    });
    const action = useMutation({
        mutationFn: ({ type, user }) => type === "delete" ? api.delete(`/admin/users/${user.id}`) : api.patch(`/admin/users/${user.id}/ban`),
        onSuccess: (_, variables) => { refresh(); tell(variables.type === "delete" ? "Đã xóa tài khoản." : "Đã đổi trạng thái tài khoản."); },
        onError: (error) => tell(message(error)),
    });
    function open(user = null) {
        setEditing(user || {});
        setForm(user ? { name: user.name, email: user.email || "", phone: user.phone || "", password: "", is_admin: user.is_admin } : blank);
    }
    function remove(user) {
        if (window.confirm(`Xóa vĩnh viễn tài khoản “${user.name}”? Dữ liệu liên quan cũng sẽ bị xóa.`)) action.mutate({ type: "delete", user });
    }

    return <section className="admin-users panel">
        <div className="admin-toolbar">
            <form className="admin-search" onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }}><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tên, email hoặc số điện thoại" /><button>Tìm</button></form>
            <button className="primary" onClick={() => open()}><Plus size={18} /> Thêm tài khoản</button>
        </div>
        <div className="admin-table-wrap"><table className="admin-table">
            <thead><tr><th>Người dùng</th><th>Liên hệ</th><th>Vai trò</th><th>Trạng thái</th><th>Ngày tạo</th><th /></tr></thead>
            <tbody>
                {isLoading && <tr><td colSpan="6">Đang tải danh sách…</td></tr>}
                {!isLoading && !data?.data?.length && <tr><td colSpan="6">Không tìm thấy tài khoản.</td></tr>}
                {data?.data?.map((user) => <tr key={user.id}>
                    <td><b>{user.name}</b>{user.id === me.id && <small>Bạn</small>}</td><td>{user.email || user.phone}</td>
                    <td><span className={user.is_admin ? "role admin" : "role"}>{user.is_admin ? "Admin" : "User"}</span></td>
                    <td><span className={user.is_banned ? "status banned" : "status active"}>{user.is_banned ? "Đã khóa" : "Hoạt động"}</span></td>
                    <td>{new Date(user.created_at).toLocaleDateString("vi-VN")}</td>
                    <td className="admin-actions"><button title="Sửa" onClick={() => open(user)}><Pencil size={16} /></button><button title={user.is_banned ? "Mở khóa" : "Khóa"} disabled={user.id === me.id} onClick={() => action.mutate({ type: "ban", user })}>{user.is_banned ? <CheckCircle2 size={16} /> : <Ban size={16} />}</button><button className="danger-icon" title="Xóa" disabled={user.id === me.id} onClick={() => remove(user)}><Trash2 size={16} /></button></td>
                </tr>)}
            </tbody>
        </table></div>
        {editing && <div className="modal-backdrop" role="dialog" aria-modal="true"><form className="dialog admin-form" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <button type="button" className="dialog-close" aria-label="Đóng" onClick={close}><X size={20} /></button><p className="eyebrow">QUẢN TRỊ TÀI KHOẢN</p><h2>{editing.id ? "Sửa người dùng" : "Thêm người dùng"}</h2>
            <label>Họ tên<input required maxLength="80" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label>Số điện thoại<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Có thể để trống nếu có email" /></label>
            <label>Mật khẩu {editing.id && <small>(để trống nếu không đổi)</small>}<input required={!editing.id} minLength={form.password ? 10 : undefined} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
            <label className="check-row"><input type="checkbox" checked={form.is_admin} disabled={editing.id === me.id} onChange={(e) => setForm({ ...form, is_admin: e.target.checked })} /> Cấp quyền quản trị</label>
            <button className="primary full" disabled={save.isPending}>{save.isPending ? "Đang lưu…" : "Lưu tài khoản"}</button>
        </form></div>}
    </section>;
}
