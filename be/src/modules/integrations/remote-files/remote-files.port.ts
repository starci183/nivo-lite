import type { RemoteFileAnswer, RemoteFileRequest } from "./remote-files.contracts"

/** The door of the back end to a file at a remote address (an image or an attachment a channel names by URL). */
export interface RemoteFiles {
    /** How many redirects a caller that follows them hop by hop may follow. */
    readonly maxRedirects: number
    /** Asks the address once; rejects with a `RemoteFilesError` when it cannot be asked. */
    read(request: RemoteFileRequest): Promise<RemoteFileAnswer>
}
