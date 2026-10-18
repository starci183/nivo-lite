/** Tracking parameters pasted links often carry; they are dropped so the same page is not added twice. */
const TRACKING = /^(fbclid|gclid|dclid|msclkid|yclid|igshid|mc_cid|mc_eid|_ga|_gl|ref_src|usp|utm_.*)$/i

/** The hosts of Google Docs and Drive: a private file or folder there needs the Drive access of the workspace. */
const GOOGLE_HOSTS = /^(drive|docs)\.google\.com$/i

/** What a pasted link points at. */
export type LinkKind = "web" | "google" | "drive-folder" | "invalid"

/** The address with tracking parameters removed and, on Google hosts, the account switch segment (/u/2/) dropped. */
const tidy = (url: URL): URL => {
    for (const key of new Set(url.searchParams.keys())) {
        if (TRACKING.test(key)) url.searchParams.delete(key)
    }
    if (GOOGLE_HOSTS.test(url.hostname)) url.pathname = url.pathname.replace(/\/u\/\d+(?=\/|$)/, "")
    return url
}

/** One pasted line, cleaned. A line that is not an http or https address is returned trimmed and unchanged. */
export const cleanLink = (raw: string): string => {
    const url = URL.canParse(raw.trim()) ? new URL(raw.trim()) : null
    return url !== null && /^https?:$/.test(url.protocol) ? tidy(url).toString() : raw.trim()
}

/** Pasted text becomes distinct, non-empty links, one per line, each cleaned. */
export const linesOfLinks = (text: string): ReadonlyArray<string> => [
    ...new Set(
        text
            .split(/\r?\n/)
            .map(cleanLink)
            .filter((line) => line !== ""),
    ),
]

/** Pasted text with newlines, spaces or commas between the links becomes distinct links. */
export const splitLinks = (text: string): ReadonlyArray<string> => linesOfLinks(text.trim().replaceAll(/[\s,]+/g, "\n"))

/** What one pasted link points at: a plain page, a Google file, a Drive folder, or no web address at all. */
export const linkKindOf = (raw: string): LinkKind => {
    if (!URL.canParse(raw.trim())) return "invalid"
    const url = tidy(new URL(raw.trim()))
    if (!/^https?:$/.test(url.protocol)) return "invalid"
    if (!GOOGLE_HOSTS.test(url.hostname)) return "web"
    const isFolder = /\/folders\/|\/drive\/(my-drive|shared-with-me)/.test(url.pathname)
    return url.hostname.toLowerCase() === "drive.google.com" && isFolder ? "drive-folder" : "google"
}
