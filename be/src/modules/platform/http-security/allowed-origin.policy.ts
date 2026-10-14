/** True for an absolute HTTP(S) origin written exactly as URL.origin, without credentials, a path or a trailing slash. */
export const isAllowedOrigin = (origin: string): boolean => {
    if (!URL.canParse(origin)) return false
    const url = new URL(origin)
    return (url.protocol === "http:" || url.protocol === "https:") && url.origin === origin
}
