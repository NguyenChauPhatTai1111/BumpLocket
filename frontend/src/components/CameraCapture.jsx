import { useEffect, useRef, useState } from "react";
import { Camera, Upload, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { api, message } from "../api";
import { useSession } from "../store";
export default function CameraCapture() {
    const video = useRef(),
        stream = useRef(),
        requestId = useRef(0);
    const [photo, setPhoto] = useState(null),
        [preview, setPreview] = useState(""),
        [caption, setCaption] = useState(""),
        [error, setError] = useState(""),
        [busy, setBusy] = useState(false),
        [facing, setFacing] = useState("user");
    const q = useQueryClient(),
        setTab = useSession((s) => s.setTab);
    function stop() {
        stream.current?.getTracks().forEach((t) => t.stop());
        stream.current = null;
    }
    useEffect(
        () => () => {
            requestId.current++;
            stop();
        },
        [],
    );
    useEffect(() => {
        if (!photo) {
            setPreview("");
            return;
        }
        const url = URL.createObjectURL(photo);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [photo]);
    async function start(direction = facing) {
        const id = ++requestId.current;
        setError("");
        stop();
        try {
            if (!navigator.mediaDevices?.getUserMedia)
                throw new Error(
                    "Camera cần HTTPS và trình duyệt hỗ trợ. Bạn có thể chọn ảnh từ máy.",
                );
            const s = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: direction, width: { ideal: 1600 } },
                audio: false,
            });
            if (id !== requestId.current) {
                s.getTracks().forEach((t) => t.stop());
                return;
            }
            stream.current = s;
            video.current.srcObject = s;
            await video.current.play();
        } catch (e) {
            setError(message(e));
        }
    }
    function capture() {
        if (!video.current?.videoWidth) {
            setError("Hãy bật camera hoặc chọn ảnh trước.");
            return;
        }
        const c = document.createElement("canvas");
        c.width = video.current.videoWidth;
        c.height = video.current.videoHeight;
        c.getContext("2d").drawImage(video.current, 0, 0);
        c.toBlob(
            (b) => {
                setPhoto(new File([b], "moment.jpg", { type: "image/jpeg" }));
                stop();
            },
            "image/jpeg",
            0.9,
        );
    }
    async function upload(e) {
        e.preventDefault();
        if (!photo) return;
        setBusy(true);
        try {
            const body = new FormData();
            body.append("image", photo);
            body.append("caption", caption);
            await api.post("/moments", body);
            q.invalidateQueries({ queryKey: ["moments"] });
            setTab("feed");
        } catch (e) {
            setError(message(e));
        } finally {
            setBusy(false);
        }
    }
    return (
        <section className="panel capture">
            <p className="eyebrow">GIỮ LẠI HÔM NAY</p>
            <h2>Không cần hoàn hảo. Chỉ cần là bạn.</h2>
            <div className="viewfinder">
                {preview ? (
                    <img src={preview} alt="Ảnh chuẩn bị đăng" />
                ) : (
                    <video ref={video} autoPlay muted playsInline />
                )}
            </div>
            <div className="camera-controls">
                {photo ? (
                    <button onClick={() => setPhoto(null)}>Chụp lại</button>
                ) : (
                    <>
                        <button onClick={() => start()}>
                            <Camera size={18} /> Bật camera
                        </button>
                        <button
                            className="shutter"
                            aria-label="Chụp ảnh"
                            onClick={capture}
                        />
                        <button
                            aria-label="Đổi camera"
                            onClick={() => {
                                const next =
                                    facing === "user" ? "environment" : "user";
                                setFacing(next);
                                start(next);
                            }}
                        >
                            <RefreshCw size={18} />
                        </button>
                    </>
                )}
                <label className="file-picker">
                    <Upload size={18} /> Chọn ảnh
                    <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                            const f = e.target.files[0];
                            if (f) {
                                stop();
                                setPhoto(f);
                            }
                        }}
                    />
                </label>
            </div>
            {error && (
                <p role="alert" className="error">
                    {error}
                </p>
            )}
            <form onSubmit={upload}>
                <textarea
                    placeholder="Hôm nay của bạn thế nào?"
                    maxLength={500}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                />
                <button className="primary" disabled={!photo || busy}>
                    {busy ? "Đang đăng…" : "Chia sẻ với bạn bè"}
                </button>
            </form>
            <p className="muted">
                Ảnh chỉ hiển thị với bạn và những người đã kết bạn.
            </p>
        </section>
    );
}
