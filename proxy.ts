import { NextResponse, type NextRequest } from "next/server";
import { isPublicTrackingRequest, requireAdminRequest, requireSameOriginMutation, requireTrackingOrigin } from "@/lib/server/access";

export function proxy(request: NextRequest) {
  if (isPublicTrackingRequest(request.nextUrl.pathname, request.method)) {
    return requireTrackingOrigin(request) ?? NextResponse.next();
  }
  return requireAdminRequest(request) ?? requireSameOriginMutation(request) ?? NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|pixel.js).*)"],
};
