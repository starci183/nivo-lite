import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import type { TiktokCreator } from "@modules/domain/provider-registry"
import type { SandboxCatalogue } from "@modules/domain/provider-sandbox"

/** The creator every sandbox account is (TIKTOK-1): what a post may be given and how long a video may be. */
export const TIKTOK_SANDBOX_CREATOR: TiktokCreator = {
    username: "sbx_creator",
    nickname: "Cửa hàng thử nghiệm",
    privacyLevelOptions: ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"],
    commentDisabled: false,
    duetDisabled: false,
    stitchDisabled: false,
    maxVideoPostDurationSec: 600,
}

/** The status words a started post walks, one per status read; the last one is where it stays. */
export interface TiktokSandboxJob {
    /** The case id in the catalogue. */
    readonly caseId: string
    /** TikTok's own status words, in order. */
    readonly words: ReadonlyArray<string>
    /** TikTok's `fail_reason` once the last word is `FAILED`, else null. */
    readonly failReason: string | null
}

/** How a named title is refused (the live refusals of a TikTok answer: a 4xx rejection or a refused token). */
export interface TiktokSandboxRefusal {
    /** The case id in the catalogue. */
    readonly caseId: string
    /** The refusal. */
    readonly reason: "rejected" | "auth_refused"
    /** TikTok's own error word, which rides as the detail. */
    readonly detail: string
}

/** The job a title the catalogue does not name starts (documented default): it downloads, then completes. */
export const TIKTOK_SANDBOX_DEFAULT_JOB: TiktokSandboxJob = { caseId: "TIKTOK-2", words: ["PROCESSING_DOWNLOAD", "PUBLISH_COMPLETE"], failReason: null }

/** The title whose job fails later (TIKTOK-6). */
export const TIKTOK_SANDBOX_FAILING_TITLE = "Clip lỗi xử lý"

/** The job of the failing title. */
export const TIKTOK_SANDBOX_FAILING_JOB: TiktokSandboxJob = {
    caseId: "TIKTOK-6",
    words: ["PROCESSING_UPLOAD", "FAILED"],
    failReason: "file_format_check_failed",
}

/** The refusal of a privacy level the creator's options do not list (TIKTOK-3), what TikTok answers to it. */
export const TIKTOK_SANDBOX_PRIVACY_REFUSAL: TiktokSandboxRefusal = {
    caseId: "TIKTOK-3",
    reason: "rejected",
    detail: "privacy_level_option_mismatch",
}

/** The titles the catalogue refuses, by the exact title of the request. */
export const TIKTOK_SANDBOX_REFUSED_TITLES: Readonly<Record<string, TiktokSandboxRefusal>> = {
    "Clip quá dài": { caseId: "TIKTOK-4", reason: "rejected", detail: "video_duration_too_long" },
    "Token TikTok hết hạn": { caseId: "TIKTOK-5", reason: "auth_refused", detail: "access_token_invalid" },
}

/** The digits a completed job's public post id starts with, before its running number (TikTok withholds the id until moderation; the sandbox answers it at once). */
export const TIKTOK_SANDBOX_POST_ID_PREFIX = "7300000000"

/** The hardcoded catalogue of the TikTok publishing sandbox (ruling R60): ids `TIKTOK-<n>`, identical on every machine. */
export const TIKTOK_SANDBOX_CATALOGUE: SandboxCatalogue = {
    provider: PROVIDER.tiktok,
    cases: [
        { id: "TIKTOK-1", label: "The creator of a sandbox account: three privacy levels, comments, duets and stitches on, up to 600 seconds", operation: "creator" },
        { id: "TIKTOK-2", label: "A post for a title the catalogue does not name is accepted; its status reads PROCESSING_DOWNLOAD, then PUBLISH_COMPLETE with the public post id", operation: "publish" },
        { id: "TIKTOK-3", label: "A privacy level the creator's options do not list is refused (rejected, privacy_level_option_mismatch, nothing started)", operation: "publish" },
        { id: "TIKTOK-4", label: "The title \"Clip quá dài\" is refused as longer than the creator may post (rejected, nothing started)", operation: "publish" },
        { id: "TIKTOK-5", label: "The title \"Token TikTok hết hạn\" is refused: the token is no longer valid (auth refused, nothing started)", operation: "publish" },
        { id: "TIKTOK-6", label: "The title \"Clip lỗi xử lý\" is accepted; its later status reads FAILED with fail_reason file_format_check_failed", operation: "status" },
        { id: "TIKTOK-7", label: "Reading the status of a publish id the account never started answers not found", operation: "status" },
    ],
}
