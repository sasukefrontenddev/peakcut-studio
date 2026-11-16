export const pairingOrigin = "http://127.0.0.1:8767";
const pairingStorageKey = "peakcut-engine-pair-v1";
export const getEngineToken = () => {
  try {
    return localStorage.getItem(pairingStorageKey) || "";
  } catch {
    return "";
  }
};
export const setEngineToken = (token) => {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Invalid pairing key");
  localStorage.setItem(pairingStorageKey, token);
};
const localHeaders = () =>
  import.meta.env.PROD ? { Authorization: "Bearer " + getEngineToken() } : {};
export const engineUrl = (path) =>
  (import.meta.env.PROD ? "http://127.0.0.1:8767" : "") + path;
export const fullStudioUrl = "http://127.0.0.1:8765/app";
export const localEngineRoute = (path) => "http://127.0.0.1:8765" + path;
export async function fetchClip(path, signal) {
  const response = await fetch(engineUrl(path), {
    signal,
    headers: localHeaders(),
    credentials: import.meta.env.PROD ? "omit" : "same-origin",
  });
  if (!response.ok)
    throw new Error(
      "Check that your local engine is running and this browser is paired.",
    );
  return response.blob();
}
export async function downloadClip(path, filename) {
  const url = URL.createObjectURL(await fetchClip(path));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
export async function api(path, options = {}) {
  if (import.meta.env.PROD && !getEngineToken())
    throw new ApiError("Connect this browser to your local engine first.", 428);
  const res = await fetch(engineUrl("/api" + path), {
    credentials: import.meta.env.PROD ? "omit" : "same-origin",
    ...options,
    headers: {
      ...localHeaders(),
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data)
    throw new ApiError(
      data?.detail ||
        "The video server is unavailable. Please try again shortly.",
      res.status,
    );
  return data;
}
export const send = (path, body, method = "POST") =>
  api(path, { method, body: JSON.stringify(body) });
export async function upload(file, options, creator, onProgress, signal) {
  const started = await send("/upload/start", {
    name: file.name,
    size: file.size,
    options,
    creator,
  });
  try {
    const size = started.part;
    for (let offset = 0, i = 0; offset < file.size; offset += size, i++) {
      if (signal.aborted)
        throw new DOMException("Upload cancelled", "AbortError");
      await api(`/upload/${started.id}/${i}`, {
        method: "PUT",
        body: file.slice(offset, offset + size),
        headers: { "Content-Type": "application/octet-stream" },
        signal,
      });
      onProgress(
        Math.min(100, Math.round(((offset + size) / file.size) * 100)),
      );
    }
    return await send(`/upload/${started.id}/finish`, {});
  } catch (err) {
    await api(`/upload/${started.id}`, { method: "DELETE" }).catch(() => {});
    throw err;
  }
}
