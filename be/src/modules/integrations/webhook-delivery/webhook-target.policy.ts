/** Parses a raw address: the usable http(s) URL, or why the text cannot be a target. */
export const refusalOfText = (raw: string): { readonly url: URL } | { readonly reason: string } => {
    if (!URL.canParse(raw.trim())) return { reason: "url" }
    const url = new URL(raw.trim())
    if (url.protocol !== "http:" && url.protocol !== "https:") return { reason: "scheme" }
    if (url.username || url.password) return { reason: "credentials" }
    return { url }
}
