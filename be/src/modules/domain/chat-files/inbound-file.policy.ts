import { isIP } from "node:net"
import { resolve, sep } from "node:path"

/** How many redirects a download follows; every hop is checked like the first address. */
export const INBOUND_FILE_MAX_REDIRECTS = 3

/** The request headers of a download: what a browser fetching a picture sends, which the CDNs of the channels expect. */
export const INBOUND_FILE_HEADERS: Readonly<Record<string, string>> = {
    accept: "image/*,application/pdf;q=0.9,*/*;q=0.5",
    "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
}

/** How long a download of a file a channel brought in may take. */
export const INBOUND_FILE_TIMEOUT_MS = 15_000

/** Host names that never name a file on the open internet. */
const INTERNAL_HOST = /^(?:localhost|.*\.local|.*\.internal|.*\.localhost)$/iu

/**
 * Whether a channel's address may be downloaded: an https address of a named host. An IP address, `localhost` and internal names are refused, so the
 * download can never be pointed at the inside of the network.
 */
export const isFetchableFileUrl = (url: string): boolean => {
    const parsed = URL.canParse(url) ? new URL(url) : null
    if (parsed === null || parsed.protocol !== "https:" || parsed.username !== "" || parsed.password !== "")
        return false
    const host = parsed.hostname.replace(/^\[|\]$/gu, "")
    return host !== "" && isIP(host) === 0 && !INTERNAL_HOST.test(host)
}

/** Whether the type the server declared for a download can be an accepted file; a server that declares none is judged by the bytes alone. */
export const isAcceptedDeclaredType = (declared: string | undefined): boolean => {
    if (declared === undefined || declared === "") return true
    const type = declared.replace(/;.*$/u, "").trim().toLowerCase()
    return (
        type.startsWith("image/") ||
        type === "application/pdf" ||
        type === "application/octet-stream" ||
        type === "binary/octet-stream"
    )
}

/** The file of a manual import as a path inside the import folder, or null when the path would leave it. */
export const importPathOf = (root: string, localPath: string): string | null => {
    const base = resolve(root)
    const target = resolve(base, localPath)
    return target.startsWith(base + sep) ? target : null
}

const REDIRECT_STATUSES: ReadonlySet<number> = new Set([301, 302, 303, 307, 308])

/** True for the statuses that send the client to another address. */
export const isRedirectStatus = (status: number): boolean => REDIRECT_STATUSES.has(status)

/** Where a redirect leads, as an absolute address (the `location` may be relative to the address that answered); null when it names none. */
export const redirectTargetOf = (location: string | undefined, from: string): string | null => {
    if (location === undefined || location === "" || !URL.canParse(location, from)) return null
    return new URL(location, from).toString()
}

/** The name a stored file gets when the sender gave none: the id of the message (kept to safe characters) and, when it is not the first file, its place. */
export const inboundFileNameOf = (given: string, ref: string, index: number, extension: string): string => {
    const stem = ref.replace(/[^A-Za-z0-9_-]/gu, "_").slice(0, 80)
    return given !== "" ? given : `${stem === "" ? "file" : stem}${index > 0 ? `-${index + 1}` : ""}.${extension}`
}
