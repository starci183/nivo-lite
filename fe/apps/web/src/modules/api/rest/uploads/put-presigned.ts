import axios from "axios"

/** What a presigned upload needs. */
export interface PutPresignedRequest {
    /** The presigned URL the back end handed out. */
    readonly url: string
    /** The file to upload. */
    readonly file: Blob
    /** The content type the address was signed for: the back end refuses the upload when the header differs. */
    readonly contentType: string
    /** Reports the upload progress as a fraction between 0 and 1. */
    readonly onProgress?: (fraction: number) => void
    /** Optional abort signal. */
    readonly signal?: AbortSignal | undefined
}

/** Uploads a file straight to the presigned storage URL (plain axios: the storage URL takes no bearer token). */
export const putPresigned = async ({ url, file, contentType, onProgress, signal }: PutPresignedRequest): Promise<void> => {
    await axios.put(url, file, {
        headers: { "Content-Type": contentType },
        ...(signal ? { signal } : {}),
        onUploadProgress: (event) => {
            if (event.total) onProgress?.(event.loaded / event.total)
        },
    })
}
