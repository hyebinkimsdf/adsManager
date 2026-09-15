import { NextResponse, type NextRequest } from "next/server";
import { isPublicTrackingRequest, requireSameOriginMutation, requireTrackingOrigin } from "@/lib/server/access";

// 포트폴리오 공개 기간(2026-10 중순까지)은 방문자가 로그인 없이 바로 둘러볼 수 있도록 admin
// 인증을 비활성화했다. 공개가 끝나면 requireAdminRequest(request)를 다시 앞단에 걸어야 한다.
export function proxy(request: NextRequest) {
  if (isPublicTrackingRequest(request.nextUrl.pathname, request.method)) {
    return requireTrackingOrigin(request) ?? NextResponse.next();
  }
  return requireSameOriginMutation(request) ?? NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|pixel.js).*)"],
};
