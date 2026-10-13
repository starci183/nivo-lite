import "server-only"

import { headers } from "next/headers"

const LOCAL_PREFIXES = ["localhost", "127.", "[::1]"]

/** The public origin the browser used for this request (forwarded host first), or undefined when no host header exists. */
export const readRequestOrigin = async (): Promise<string | undefined> => {
    const list = await headers()
    const host = list.get("x-forwarded-host")?.split(",")[0]?.trim() ?? list.get("host")
    if (host === null || host === undefined || host === "") return undefined
    const forwarded = list.get("x-forwarded-proto")?.split(",")[0]?.trim()
    const local = LOCAL_PREFIXES.some((prefix) => host.startsWith(prefix))
    return `${forwarded ?? (local ? "http" : "https")}://${host}`
}
