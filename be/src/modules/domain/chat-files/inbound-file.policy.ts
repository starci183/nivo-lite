import { isIP } from "node:net"
import { resolve, sep } from "node:path"

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
    if (parsed === null || parsed.protocol !== "https:" || parsed.username !== "" || parsed.password !== "") return false
    const host = parsed.hostname.replace(/^\[|\]$/gu, "")
    return host !== "" && isIP(host) === 0 && !INTERNAL_HOST.test(host)
}

/** Whether the type the server declared for a download can be an accepted file; a server that declares none is judged by the bytes alone. */
export const isAcceptedDeclaredType = (declared: string | undefined): boolean => {
    if (declared === undefined || declared === "") return true
    const type = declared.replace(/;.*$/u, "").trim().toLowerCase()
    return type.startsWith("image/") || type === "application/pdf" || type === "application/octet-stream" || type === "binary/octet-stream"
}

/** The file of a manual import as a path inside the import folder, or null when the path would leave it. */
export const importPathOf = (root: string, localPath: string): string | null => {
    const base = resolve(root)
    const target = resolve(base, localPath)
    return target.startsWith(base + sep) ? target : null
}
