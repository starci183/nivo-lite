import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import type { SandboxCatalogue } from "@modules/domain/provider-sandbox"

/** How a Facebook sandbox post ends: accepted, or refused the way the live twin refuses it. */
export type FacebookSandboxOutcome =
    | { readonly kind: "accepted" }
    | { readonly kind: "refused"; readonly reason: "rejected" | "auth_refused"; readonly detail: string }

/** One named post of the catalogue: the message (the natural key of a post) it is picked by and how it ends. */
export interface FacebookSandboxPost {
    /** The case id in the catalogue. */
    readonly caseId: string
    /** How it ends. */
    readonly outcome: FacebookSandboxOutcome
}

/** The Page id every sandbox post id starts with (a Page post id is `<page id>_<post number>`). */
export const FACEBOOK_SANDBOX_PAGE_ID = "100000000000001"

/** The case a message the catalogue does not name falls to: an accepted post (documented default). */
export const FACEBOOK_SANDBOX_DEFAULT_CASE = "FACEBOOK-1"

/** The posts the catalogue names, by the exact message of the request. */
export const FACEBOOK_SANDBOX_POSTS: Readonly<Record<string, FacebookSandboxPost>> = {
    "Mua ngay giá sốc, số lượng có hạn": {
        caseId: "FACEBOOK-4",
        outcome: { kind: "refused", reason: "rejected", detail: "policy: spam content" },
    },
    "Video quay toàn bộ buổi lễ": {
        caseId: "FACEBOOK-5",
        outcome: { kind: "refused", reason: "rejected", detail: "video file too large" },
    },
    "Bài đăng khi token hết hạn": {
        caseId: "FACEBOOK-6",
        outcome: { kind: "refused", reason: "auth_refused", detail: "Error validating access token: session expired" },
    },
}

/** The hardcoded catalogue of the Facebook Page publishing sandbox (ruling R60): ids `FACEBOOK-<n>`, identical on every machine. */
export const FACEBOOK_SANDBOX_CATALOGUE: SandboxCatalogue = {
    provider: PROVIDER.meta,
    cases: [
        { id: "FACEBOOK-1", label: "A text or link post (any message the catalogue does not name) is accepted: the Page feed answers a post id", operation: "publish" },
        { id: "FACEBOOK-2", label: "A photo post is accepted: the post id and the photo's own id", operation: "publish" },
        { id: "FACEBOOK-3", label: "A video post is accepted: no post id yet, only the video's own id", operation: "publish" },
        { id: "FACEBOOK-4", label: "The message \"Mua ngay giá sốc, số lượng có hạn\" is refused by the content policy (rejected, nothing posted)", operation: "publish" },
        { id: "FACEBOOK-5", label: "The message \"Video quay toàn bộ buổi lễ\" is refused as too large a video (rejected, nothing posted)", operation: "publish" },
        { id: "FACEBOOK-6", label: "The message \"Bài đăng khi token hết hạn\" is refused: the Page token expired (auth refused, nothing posted)", operation: "publish" },
    ],
}
