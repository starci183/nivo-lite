import { negotiateLocale } from "@nivo-lite/i18n/proxy"
import type { NextRequest, NextResponse } from "next/server"

/** The first path segments no locale is negotiated for: liveness and framework files. */
const UNNEGOTIATED_ROOTS: ReadonlySet<string> = new Set(["health", "_next", "_vercel"])

/** Locale routing only: the landing has no session, and every path that is not a landing page is redirected to the console by next.config.ts. */
export const proxy = (request: NextRequest): NextResponse => negotiateLocale(request, UNNEGOTIATED_ROOTS)

/** Routes that pass through locale negotiation. */
export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|.*.(?:svg|png|jpg|jpeg|webp)$).*)"],
}
