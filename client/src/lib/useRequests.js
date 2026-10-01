import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";

// Loads the request list and refreshes it every 30 seconds and whenever the
// app comes back to the front, so status changes show up without reloading.
export function useRequests() {
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api("/requests");
      setRequests(data.requests);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000);
    const onFocus = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("online", load);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("online", load);
    };
  }, [load]);

  return { requests, error, reload: load };
}
