/** The limits every read of a remote file is held to, whatever its caller asks. */
export interface RemoteFilesOptions {
    /** The most bytes any remote file may hold: a caller's own limit above it is lowered to it. */
    readonly maxBytes: number
    /** The longest wait for an answer, in milliseconds: a caller's own deadline above it is lowered to it. */
    readonly timeoutMs: number
    /** How many redirects a caller that follows them hop by hop may follow. */
    readonly maxRedirects: number
}
