import { createProxy, type LocaleProxy } from "@starci/next-i18n/proxy"
import { i18n } from "@/modules/i18n"

/** Locale routing only: the landing has no session, and every path that is not a landing page is redirected to the console by next.config.ts. */
export const proxy: LocaleProxy = createProxy(i18n, { unnegotiatedRoots: ["health", "_next", "_vercel"] })

type ConfigShape = {
    matcher: string[]
}

/** Routes that pass through locale negotiation. */
export const config: ConfigShape = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|.*.(?:svg|png|jpg|jpeg|webp)$).*)"],
}
