export const getApiUrl = () => {
    // If NEXT_PUBLIC_API_URL is set (e.g. in cloud env), use it
    if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;

    // Otherwise, assume backend is on same host as frontend but port 8000
    // This allows accessing via 192.168.x.x without changing code
    if (typeof window !== "undefined") {
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        return `${protocol}//${hostname}:8000`;
    }

    return "http://localhost:8000"; // Fallback for SSR
};

export const getWsUrl = (path: string) => {
    const apiUrl = getApiUrl();
    const wsProtocol = apiUrl.startsWith("https") ? "wss" : "ws";
    // unique logic to strip http/https and append path
    const host = apiUrl.replace(/^https?:\/\//, "");
    return `${wsProtocol}://${host}${path}`;
};
