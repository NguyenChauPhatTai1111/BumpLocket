import { api } from "./api";
let audioContext;
export async function unlockSound() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (Audio) {
        audioContext ||= new Audio();
        await audioContext.resume();
    }
}
export function ring() {
    if (document.visibilityState !== "visible") return;
    navigator.vibrate?.([200, 100, 200]);
    if (audioContext?.state === "running") {
        const osc = audioContext.createOscillator(),
            gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = 720;
        gain.gain.setValueAtTime(0.08, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            0.001,
            audioContext.currentTime + 0.5,
        );
        osc.start();
        osc.stop(audioContext.currentTime + 0.5);
    }
}
export async function enablePush() {
    await unlockSound();
    if (!("serviceWorker" in navigator) || !("PushManager" in window))
        throw new Error(
            "Trình duyệt chưa hỗ trợ Push. Trên iPhone, hãy thêm BumpLocket vào màn hình chính.",
        );
    const { data } = await api.get("/config");
    if (!data.vapid_public_key)
        throw new Error(
            "Máy chủ chưa cấu hình VAPID. Thông báo trong ứng dụng vẫn hoạt động.",
        );
    if ((await Notification.requestPermission()) !== "granted")
        throw new Error("Bạn chưa cho phép thông báo.");
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
        const base = data.vapid_public_key
            .replace(/-/g, "+")
            .replace(/_/g, "/");
        const bytes = Uint8Array.from(
            atob(base + "=".repeat((4 - (base.length % 4)) % 4)),
            (c) => c.charCodeAt(0),
        );
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: bytes,
        });
    }
    await api.post("/push/subscriptions", subscription.toJSON());
}
export async function disablePush() {
    const r = await navigator.serviceWorker?.getRegistration();
    const s = await r?.pushManager?.getSubscription();
    if (s) {
        await api.delete("/push/subscriptions", {
            data: { endpoint: s.endpoint },
        });
        await s.unsubscribe();
    }
}
