import { APP_ROUTES, safeNextPath } from "@/modules/routes"

/** Unwraps one legacy confirmation destination, keeping every destination behind the existing validator. */
export const callbackNext = (rawNext: string | null, origin: string): string | null => {
    const inner = rawNext ? safeNextPath(rawNext, origin) : null
    const innerUrl = new URL(inner ?? "/", origin)
    const directNext = inner === "/" && rawNext !== "/" ? null : inner
    const isNested = innerUrl.pathname === "/auth/confirm" || innerUrl.pathname === APP_ROUTES.authCallback
    return directNext !== null && isNested ? safeNextPath(innerUrl.searchParams.get("next"), origin) : directNext
}
