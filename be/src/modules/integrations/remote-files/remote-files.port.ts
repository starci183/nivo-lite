import type { RemoteFileAnswer, RemoteFileRequest } from "./remote-files.contracts"

/** The door of the back end to a file at a remote address (an image or an attachment a channel names by URL). */
export interface RemoteFiles {
    /** Asks the address once; rejects with a `RemoteFilesError` when it cannot be asked. */
    read(request: RemoteFileRequest): Promise<RemoteFileAnswer>
}
