export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
export async function api(path, options = {}) {
  const res = await fetch("/api" + path, {
    credentials: "same-origin",
    ...options,
    headers: {
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
