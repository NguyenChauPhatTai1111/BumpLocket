import { useState } from "react";
import { Radio, X } from "lucide-react";
import { api, message } from "../api";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "../store";
import { unlockSound } from "../notifications";
export default function BumpButton({ friend }) {
    const [open, setOpen] = useState(false),
        [minutes, setMinutes] = useState(15),
        [busy, setBusy] = useState(false);
    const q = useQueryClient(),
        tell = useSession((s) => s.tell);
    async function send() {
        setBusy(true);
        try {
            await unlockSound();
            await api.post("/bumps", {
                to_user_id: friend.id,
                duration_minutes: minutes,
                consent: true,
            });
            q.invalidateQueries({ queryKey: ["bumps"] });
            tell(
                "Đã gửi Bump. Vị trí chưa được chia sẻ cho đến khi bạn ấy đồng ý.",
            );
            setOpen(false);
        } catch (e) {
            tell(message(e));
        } finally {
            setBusy(false);
        }
    }
    return (
        <>
            <button className="bump-button" onClick={() => setOpen(true)}>
                <Radio size={16} /> Bump
            </button>
            {open && (
                <div className="overlay">
                    <section className="dialog">
                        <button
                            className="close"
                            aria-label="Đóng"
                            onClick={() => setOpen(false)}
                        >
                            <X />
                        </button>
                        <div className="dialog-symbol">
                            <Radio />
                        </div>
                        <h2>Bump với {friend.name}?</h2>
                        <p>
                            Sau khi bạn ấy đồng ý, hai bạn sẽ chia sẻ vị trí với
                            nhau trong thời gian đã chọn. Mỗi người có thể dừng
                            bất cứ lúc nào.
                        </p>
                        <label>
                            Thời gian
                            <select
                                value={minutes}
                                onChange={(e) =>
                                    setMinutes(Number(e.target.value))
                                }
                            >
                                <option value={15}>15 phút</option>
                                <option value={30}>30 phút</option>
                            </select>
                        </label>
                        <button
                            className="primary"
                            onClick={send}
                            disabled={busy}
                        >
                            {busy ? "Đang gửi…" : "Đồng ý & gửi Bump"}
                        </button>
                    </section>
                </div>
            )}
        </>
    );
}
