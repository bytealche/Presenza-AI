export const getApiUrl = () => {
    // If NEXT_PUBLIC_API_URL is set (e.g. in cloud env), use it
    if (process.env.NEXT_PUBLIC_API_URL) {
        return process.env.NEXT_PUBLIC_API_URL;
    }

    // In production, if it's missing, we log a warning but still fail gracefully
    if (process.env.NODE_ENV === "production") {
        console.warn("NEXT_PUBLIC_API_URL is not set in production. Ensure environment variables are loaded.");
        // Fallback relative or assumed domain if possible, but default empty to avoid localhost leakage
        return "";
    }

    // Otherwise (local dev), assume backend is on same host as frontend
    if (typeof window !== "undefined") {
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        return `${protocol}//${hostname}:8000`;
    }

    return "http://localhost:8000"; // Fallback for SSR during dev
};

export const getWsUrl = (path: string) => {
    const apiUrl = getApiUrl();
    const wsProtocol = apiUrl.startsWith("https") ? "wss" : "ws";
    // unique logic to strip http/https and append path
    const host = apiUrl.replace(/^https?:\/\//, "");
    return `${wsProtocol}://${host}${path}`;
};
