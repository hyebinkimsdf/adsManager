import { createHash, timingSafeEqual } from "node:crypto";

function matches(actual: string, expected: string): boolean {
  return timingSafeEqual(createHash("sha256").update(actual).digest(), createHash("sha256").update(expected).digest());
}

/** 현재 앱은 하나의 운영 작업공간이다. 운영 배포에서는 관리자 인증을 생략하지 않는다. */
export function requireAdminRequest(request: Request): Response | null {
  const password = process.env.ADS_ADMIN_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV === "development" && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname)) return null;
    return Response.json({ error: "관리자 접근 설정이 필요합니다. ADS_ADMIN_PASSWORD를 설정해주세요." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator >= 0 && matches(decoded.slice(0, separator), process.env.ADS_ADMIN_USERNAME || "admin") && matches(decoded.slice(separator + 1), password)) return null;
  }
  return Response.json({ error: "관리자 로그인이 필요합니다." }, { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Ads Manager", charset="UTF-8"', "Cache-Control": "no-store" } });
}

export function isPublicTrackingRequest(path: string, method: string): boolean {
  return (path === "/api/tracking/events" && ["POST", "OPTIONS"].includes(method)) ||
    (path === "/api/tracking/scan" && ["POST", "OPTIONS"].includes(method)) ||
    (path === "/api/tracking/rules" && ["GET", "OPTIONS"].includes(method));
}

export function requireTrackingOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  // Same-origin test calls are authenticated separately by the event endpoint.
  if (origin === new URL(request.url).origin) return null;
  const allowed = (process.env.ADS_TRACKING_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (origin && allowed.includes(origin)) return null;
  if (!origin && request.method === "GET") return null; // Public rules contain only browser selectors.
  return Response.json({ error: "등록되지 않은 수집 사이트입니다." }, { status: 403, headers: { "Cache-Control": "no-store" } });
}

export function requireSameOriginMutation(request: Request): Response | null {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return null;
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== new URL(request.url).origin)) {
    return Response.json({ error: "다른 사이트에서 관리자 설정을 변경할 수 없습니다." }, { status: 403 });
  }
  return null;
}
