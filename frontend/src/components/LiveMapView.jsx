import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigation, Square, ShieldCheck } from "lucide-react";
import { api, message } from "../api";
import { useSession } from "../store";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
export default function LiveMapView({ bump }) {
    const node = useRef(),
        map = useRef(),
        markers = useRef([]),
        watch = useRef(null),
        last = useRef(0);
    const [gps, setGps] = useState(false),
        [now, setNow] = useState(Date.now()),
        [error, setError] = useState(""),
        [mapReady, setMapReady] = useState(false);
    const q = useQueryClient();
    const expired = now >= new Date(bump.expires_at).getTime();
    const { data } = useQuery({
        queryKey: ["locations", bump.id],
        queryFn: () =>
            api.get("/bumps/" + bump.id + "/locations").then((r) => r.data),
        refetchInterval: 5000,
        enabled: !expired,
        retry: false,
    });
    function clear() {
        if (watch.current !== null)
            navigator.geolocation?.clearWatch(watch.current);
        watch.current = null;
    }
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => {
            clearInterval(t);
            clear();
        };
    }, [bump.id]);
    useEffect(() => {
        if (expired) {
            clear();
            setGps(false);
            q.removeQueries({ queryKey: ["locations", bump.id] });
            q.invalidateQueries({ queryKey: ["bumps"] });
        }
    }, [expired]);
    async function stop() {
        clear();
        setGps(false);
        try {
            await api.delete("/bumps/" + bump.id);
            q.removeQueries({ queryKey: ["locations", bump.id] });
            q.invalidateQueries({ queryKey: ["bumps"] });
        } catch (e) {
            setError(
                "GPS trên máy đã dừng. Chưa thể báo máy chủ; hãy thử dừng lại. " +
                    message(e),
            );
        }
    }
    function start() {
        if (!navigator.geolocation) {
            setError("Trình duyệt không hỗ trợ GPS.");
            return;
        }
        setError("");
        setGps(true);
        clear();
        watch.current = navigator.geolocation.watchPosition(
            async (position) => {
                if (Date.now() >= new Date(bump.expires_at).getTime()) {
                    clear();
                    return;
                }
                if (Date.now() - last.current < 5500) return;
                last.current = Date.now();
                try {
                    await api.put("/bumps/" + bump.id + "/location", {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                    });
                    q.invalidateQueries({ queryKey: ["locations", bump.id] });
                } catch (e) {
                    setError(message(e));
                    if ([403, 410, 401].includes(e.response?.status)) {
                        clear();
                        setGps(false);
                    }
                }
            },
            (e) => {
                clear();
                setGps(false);
                setError(
                    e.code === 1
                        ? "Bạn chưa cấp quyền vị trí. Có thể dừng phiên hoặc cấp lại trong cài đặt trình duyệt."
                        : "Chưa lấy được GPS. Hãy thử lại.",
                );
            },
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
        );
    }
    useEffect(() => {
        if (!node.current) return;
        map.current = new mapboxgl.Map({
            container: node.current,
            style: {
                version: 8,
                sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" } },
                layers: [{ id: "osm", type: "raster", source: "osm" }],
            },
            center: [106.7, 10.77],
            zoom: 12,
        });
        map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
        map.current.on("load", () => setMapReady(true));
        map.current.on("error", () => setError("Không tải được lớp bản đồ. Hãy kiểm tra kết nối mạng."));
        return () => {
            setMapReady(false);
            map.current?.remove();
            map.current = null;
        };
    }, []);
    useEffect(() => {
        if (!map.current || !mapReady || !data || expired) return;
        markers.current.forEach((m) => m.remove());
        markers.current = data.positions.map((p) =>
            new mapboxgl.Marker({
                color: p.user_id === bump.from_user_id ? "#6f8bff" : "#de8f54",
            })
                .setLngLat([p.lng, p.lat])
                .addTo(map.current),
        );
        if (data.positions.length) {
            const bounds = new mapboxgl.LngLatBounds();
            data.positions.forEach((p) => bounds.extend([p.lng, p.lat]));
            map.current.fitBounds(bounds, { padding: 70, maxZoom: 16 });
        }
    }, [data, expired, mapReady]);
    const remaining = Math.max(
        0,
        Math.ceil((new Date(bump.expires_at) - now) / 1000),
    );
    return (
        <section className="panel live-map">
            <div className="section-title">
                <h2>
                    <span className="live-dot" /> Phiên Bump đang mở
                </h2>
                <span>
                    {Math.floor(remaining / 60)}:
                    {String(remaining % 60).padStart(2, "0")}
                </span>
            </div>
            <p>
                {bump.sender.name} & {bump.recipient.name}
            </p>
            <div className="map-container" ref={node} />
            {!expired &&
                data?.positions.map((p) => (
                    <p className="coordinates" key={p.user_id}>
                        {p.user_id === bump.from_user_id
                            ? bump.sender.name
                            : bump.recipient.name}
                        : {Number(p.lat).toFixed(5)}, {Number(p.lng).toFixed(5)}{" "}
                        · ±{Math.round(p.accuracy)}m ·{" "}
                        {new Date(p.updated_at).toLocaleTimeString("vi-VN")}
                    </p>
                ))}
            {error && (
                <p role="alert" className="error">
                    {error}
                </p>
            )}
            <div className="inline">
                {!gps && !expired && (
                    <button className="primary" onClick={start}>
                        <Navigation size={16} /> Bật GPS cho phiên này
                    </button>
                )}
                <button className="stop" onClick={stop}>
                    <Square size={16} /> Dừng chia sẻ
                </button>
            </div>
            <p className="muted">
                <ShieldCheck size={14} /> GPS có thể bị hệ điều hành tạm dừng
                khi tab ẩn hoặc khóa màn hình. Chia sẻ sẽ tự hết hạn.
            </p>
        </section>
    );
}
