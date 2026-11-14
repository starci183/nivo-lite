import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import type { SandboxCatalogue } from "@modules/domain/provider-sandbox"

/** The `status_code` words a container goes through, in the order its status reads walk them (the last one is where it stays). */
export type InstagramSandboxCodes = ReadonlyArray<"IN_PROGRESS" | "FINISHED" | "ERROR">

/** How an Instagram sandbox media request ends. */
export type InstagramSandboxOutcome =
    | { readonly kind: "container"; readonly codes: InstagramSandboxCodes }
    | { readonly kind: "refused"; readonly reason: "rejected" | "auth_refused"; readonly detail: string }

/** One named media request of the catalogue: the case id and how it ends. */
export interface InstagramSandboxMedia {
    /** The case id in the catalogue. */
    readonly caseId: string
    /** How it ends. */
    readonly outcome: InstagramSandboxOutcome
}

/** The case a caption the catalogue does not name falls to: a container that is finished at once (documented default). */
export const INSTAGRAM_SANDBOX_DEFAULT_CASE = "INSTAGRAM-1"

/** The longest carousel Instagram content publishing documents (the live adapter refuses a longer one before anything is sent). */
export const INSTAGRAM_SANDBOX_CAROUSEL_MAX = 20

/** The media requests the catalogue names, by the exact caption of the request. */
export const INSTAGRAM_SANDBOX_MEDIA: Readonly<Record<string, InstagramSandboxMedia>> = {
    "Reel hậu trường buổi chụp": { caseId: "INSTAGRAM-2", outcome: { kind: "container", codes: ["IN_PROGRESS", "FINISHED"] } },
    "Reel lỗi mã hóa": { caseId: "INSTAGRAM-3", outcome: { kind: "container", codes: ["IN_PROGRESS", "ERROR"] } },
    "Caption vi phạm chính sách": { caseId: "INSTAGRAM-4", outcome: { kind: "refused", reason: "rejected", detail: "policy: media violates community guidelines" } },
    "Video quá dài": { caseId: "INSTAGRAM-5", outcome: { kind: "refused", reason: "rejected", detail: "video duration over the limit" } },
    "Bài đăng khi token hết hạn": {
        caseId: "INSTAGRAM-6",
        outcome: { kind: "refused", reason: "auth_refused", detail: "Error validating access token: session expired" },
    },
}

/** The hardcoded catalogue of the Instagram publishing sandbox (ruling R60): ids `INSTAGRAM-<n>`, identical on every machine. */
export const INSTAGRAM_SANDBOX_CATALOGUE: SandboxCatalogue = {
    provider: PROVIDER.meta,
    cases: [
        { id: "INSTAGRAM-1", label: "A media request the catalogue does not name creates a container that is finished at once and is published in the same call", operation: "publish" },
        { id: "INSTAGRAM-2", label: "The caption \"Reel hậu trường buổi chụp\" creates a container still processing; a later status read says finished, release publishes it", operation: "publish" },
        { id: "INSTAGRAM-3", label: "The caption \"Reel lỗi mã hóa\" creates a container whose later status read says ERROR (failed, never publishable)", operation: "status" },
        { id: "INSTAGRAM-4", label: "The caption \"Caption vi phạm chính sách\" is refused by the content policy (rejected, nothing created)", operation: "publish" },
        { id: "INSTAGRAM-5", label: "The caption \"Video quá dài\" is refused as too long a video (rejected, nothing created)", operation: "publish" },
        { id: "INSTAGRAM-6", label: "The caption \"Bài đăng khi token hết hạn\" is refused: the token expired (auth refused)", operation: "publish" },
        { id: "INSTAGRAM-7", label: "Releasing or reading a container the account never created answers not found", operation: "release" },
    ],
}
