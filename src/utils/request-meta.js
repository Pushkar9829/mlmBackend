export function requestMeta(req) {
  const userAgent = String(req.headers["user-agent"] || "").slice(0, 300);
  return {
    ip: req.ip || "",
    userAgent,
  };
}
