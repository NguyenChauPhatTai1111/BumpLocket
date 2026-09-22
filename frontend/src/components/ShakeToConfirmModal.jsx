import { useEffect, useRef, useState } from "react";
import { Radio } from "lucide-react";
import { api, message } from "../api";
import { useSession } from "../store";
import { useQueryClient } from "@tanstack/react-query";
export default function ShakeToConfirmModal({ bump }) {
    const [enabled, setEnabled] = useState(false),
        [busy, setBusy] = useState(false);
    const busyRef = useRef(false),
        last = useRef(0),
        tell = useSession((s) => s.tell),
        q = useQueryClient();
    async function respond(action) {
        if (busyRef.current) return;
        busyRef.current = true;
        setBusy(true);
        try {
            await api.patch("/bumps/" + bump.id, {
                action,
                ...(action === "accept" ? { consent: true } : {}),
            });
            q.invalidateQueries({ queryKey: ["bumps"] });
        } catch (e) {
            tell(message(e));
        } finally {
            busyRef.current = false;
            setBusy(false);
        }
    }
    useEffect(() => {
        if (!enabled) return;
        const motion = (e) => {
            const a = e.acceleration;
            if (!a) return;
            const force = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
            if (force > 20 && Date.now() - last.current > 2000) {
                last.current = Date.now();
                respond("accept");
            }
        };
        window.addEventListener("devicemotion", motion);
        return () => window.removeEventListener("devicemotion", motion);
    }, [enabled, bump.id]);
    async function allowShake() {
        try {
            if (!window.DeviceMotionEvent)
                throw new Error(
                    "Thiết bị không hỗ trợ cảm biến. Dùng nút Đồng ý.",
                );
            if (
                typeof DeviceMotionEvent.requestPermission === "function" &&
                (await DeviceMotionEvent.requestPermission()) !== "granted"
            )
                return;
            setEnabled(true);
        } catch (e) {
            tell(message(e));
        }
    }
    return (
        <div className="overlay">
            <section className="dialog">
                <div className="dialog-symbol pulse">
                    <Radio />
                </div>
                <p className="eyebrow">BẠN CÓ MỘT BUMP</p>
                <h2>{bump.sender.name} muốn chia sẻ vị trí</h2>
                <p>
                    Nếu đồng ý, cả hai sẽ thấy vị trí của nhau trong{" "}
                    {bump.duration_minutes} phút. Bạn có thể dừng bất cứ lúc
                    nào. Không chia sẻ khi từ chối.
                </p>
                <button
                    className="primary"
                    disabled={busy}
                    onClick={() => respond("accept")}
                >
                    Đồng ý chia sẻ {bump.duration_minutes} phút
                </button>
                <button disabled={busy} onClick={() => respond("reject")}>
                    Để lúc khác
                </button>
                <button className="text" onClick={allowShake}>
                    {enabled
                        ? "Đã bật: lắc để đồng ý"
                        : "Bật cảm biến lắc để đồng ý"}
                </button>
            </section>
        </div>
    );
}
