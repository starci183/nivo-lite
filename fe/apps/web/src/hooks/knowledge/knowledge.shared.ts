import { createBrowserDbClient } from "@/modules/db/browser"

/** The private bucket documents are uploaded to, under `<workspaceId>/<uuid>/<filename>`. */
const UPLOAD_BUCKET = "knowledge-uploads"

/** Storage keys are plain: no folders, no spaces or marks that a path or an address could trip on. */
const safeName = (name: string): string => {
    const base = (name.split(/[\/]/).pop() ?? "")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .replace(/[^\w.-]+/g, "_")
        .replace(/^_+|_+$/g, "")
    return (base || "file").slice(-120)
}

/** Uploads a document into the private bucket of the workspace (managers only, by the bucket policy); answers its storage path, or null when the upload failed. */
export const uploadDocument = async (workspaceId: string, file: File): Promise<string | null> => {
    const path = `${workspaceId}/${crypto.randomUUID()}/${safeName(file.name)}`
    const bucket = createBrowserDbClient().storage.from(UPLOAD_BUCKET)
    const signed = await bucket.createSignedUploadUrl(path)
    if (signed.error !== null) return null
    const sent = await bucket.uploadToSignedUrl(path, signed.data.token, file)
    return sent.error === null ? path : null
}
