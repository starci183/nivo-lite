import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import type { SandboxCatalogue } from "@modules/domain/provider-sandbox"

/** One step of a video's processing as one status read answers it (YouTube's own words of the Video resource). */
export interface YoutubeSandboxStep {
    /** `status.uploadStatus`. */
    readonly uploadStatus: "uploaded" | "processed" | "failed" | "rejected"
    /** `processingDetails.processingStatus`. */
    readonly processingStatus: "processing" | "succeeded" | "failed" | "terminated"
    /** `status.failureReason` or `status.rejectionReason`, else null. */
    readonly reason: string | null
}

/** The steps a video walks, one per status read; the last one is where it stays. */
export interface YoutubeSandboxJob {
    /** The case id in the catalogue. */
    readonly caseId: string
    /** The steps, in order. */
    readonly steps: ReadonlyArray<YoutubeSandboxStep>
}

/** How a named title is refused at the upload (the live twin's own refusals). */
export interface YoutubeSandboxRefusal {
    /** The case id in the catalogue. */
    readonly caseId: string
    /** The refusal. */
    readonly reason: "rejected" | "not_found" | "auth_refused" | "not_available"
    /** The provider's words, which ride as the detail. */
    readonly detail: string
}

/** The job a title the catalogue does not name starts (documented default): uploaded, then processed. */
export const YOUTUBE_SANDBOX_DEFAULT_JOB: YoutubeSandboxJob = {
    caseId: "YOUTUBE-1",
    steps: [
        { uploadStatus: "uploaded", processingStatus: "processing", reason: null },
        { uploadStatus: "processed", processingStatus: "succeeded", reason: null },
    ],
}

/** The titles whose video is accepted and fails later, by the exact title of the request. */
export const YOUTUBE_SANDBOX_JOBS: Readonly<Record<string, YoutubeSandboxJob>> = {
    "Video lỗi xử lý": {
        caseId: "YOUTUBE-3",
        steps: [
            { uploadStatus: "uploaded", processingStatus: "processing", reason: null },
            { uploadStatus: "failed", processingStatus: "failed", reason: "codec" },
        ],
    },
    "Video vi phạm bản quyền": {
        caseId: "YOUTUBE-4",
        steps: [
            { uploadStatus: "uploaded", processingStatus: "processing", reason: null },
            { uploadStatus: "rejected", processingStatus: "terminated", reason: "copyright" },
        ],
    },
}

/** The titles refused at the upload, by the exact title of the request. */
export const YOUTUBE_SANDBOX_REFUSED_TITLES: Readonly<Record<string, YoutubeSandboxRefusal>> = {
    "Video quá lớn": { caseId: "YOUTUBE-5", reason: "not_found", detail: "video file" },
    "Token Google hết hạn": { caseId: "YOUTUBE-6", reason: "auth_refused", detail: "Invalid Credentials" },
}

/** The refusal of a thumbnail (YOUTUBE-7): the live adapter refuses it before anything is sent, its documentation does not state the body. */
export const YOUTUBE_SANDBOX_THUMBNAIL_REFUSAL: YoutubeSandboxRefusal = {
    caseId: "YOUTUBE-7",
    reason: "not_available",
    detail: "thumbnails.set: docs-missing",
}

/** The playlist the sandbox account does not hold (YOUTUBE-8): the video is uploaded, the add is answered `not_found`. */
export const YOUTUBE_SANDBOX_MISSING_PLAYLIST = "PL-KHONG-CO"

/** The hardcoded catalogue of the YouTube publishing sandbox (ruling R60): ids `YOUTUBE-<n>`, identical on every machine. */
export const YOUTUBE_SANDBOX_CATALOGUE: SandboxCatalogue = {
    provider: PROVIDER.google,
    cases: [
        { id: "YOUTUBE-1", label: "An upload for a title the catalogue does not name is accepted; its status reads uploaded, then processed", operation: "publish" },
        { id: "YOUTUBE-2", label: "An upload that names a playlist is added to it: the answer carries the playlist item id", operation: "publish" },
        { id: "YOUTUBE-3", label: "The title \"Video lỗi xử lý\" is accepted; its later status reads failed with the failure reason codec", operation: "status" },
        { id: "YOUTUBE-4", label: "The title \"Video vi phạm bản quyền\" is accepted; its later status reads rejected with the reason copyright", operation: "status" },
        { id: "YOUTUBE-5", label: "The title \"Video quá lớn\" is refused: the file store holds no such video within the size limit (not found, nothing uploaded)", operation: "publish" },
        { id: "YOUTUBE-6", label: "The title \"Token Google hết hạn\" is refused: the credential is no longer valid (auth refused, nothing uploaded)", operation: "publish" },
        { id: "YOUTUBE-7", label: "An upload with a thumbnail is refused before anything is sent (not available, thumbnails.set: docs-missing)", operation: "publish" },
        { id: "YOUTUBE-8", label: "An upload naming the playlist PL-KHONG-CO is accepted and the video exists; the playlist add failed: playlistFailure not_found", operation: "publish" },
        { id: "YOUTUBE-9", label: "Reading the status of a video the account never uploaded answers not found", operation: "status" },
    ],
}
