import type { ConnectionRecord } from "@modules/domain/connections"
import type { ProviderFile } from "./media-ports.contracts"

/**
 * THE TIKTOK DESTINATION: a port for the providers that reach TikTok. TikTok is a DOMAIN (destination), not a generic purpose: its
 * contract is TikTok's own (privacy level, duet / stitch / comment switches, cover frame) and no other destination substitutes it. A
 * failure is thrown with what it proves (`withProof`); a refusal the platform answered is a `providerRefusal` (a `ProviderRegistryError`).
 */

/** Where the video comes from: an https address TikTok pulls (its domain must be verified with TikTok), or a file NIVO sends in chunks. */
export type TiktokVideoSource =
    | { readonly kind: "url"; readonly videoUrl: string }
    | { readonly kind: "file"; readonly file: ProviderFile }

/** What a TikTok publish is asked for (direct post). */
export interface TiktokPublishRequest {
    /** The video. */
    readonly source: TiktokVideoSource
    /** One of the creator's `privacyLevelOptions`. */
    readonly privacyLevel: string
    /** The caption, or null for none. */
    readonly title: string | null
    /** Blocks Duets, or null for the creator's default. */
    readonly disableDuet: boolean | null
    /** Blocks Stitches, or null. */
    readonly disableStitch: boolean | null
    /** Blocks comments, or null. */
    readonly disableComment: boolean | null
    /** The cover frame in milliseconds, or null for the first frame. */
    readonly coverTimestampMs: number | null
    /** A paid partnership promoting a third party, or null. */
    readonly brandContentToggle: boolean | null
    /** The video promotes the creator's own business, or null. */
    readonly brandOrganicToggle: boolean | null
    /** Adds TikTok's AI-generated label, or null. */
    readonly isAigc: boolean | null
}

/** A publish TikTok accepted: its tracking id, polled with `status`. */
export interface TiktokPublishStarted {
    /** TikTok's `publish_id`. */
    readonly publishId: string
}

/** Where a TikTok post stands: still being fetched or processed, published, or failed with TikTok's reason. */
export type TiktokPublishState = "pending" | "published" | "failed"

/** One post as it stands. */
export interface TiktokPublishStatus {
    /** The publish id. */
    readonly publishId: string
    /** Where it stands. */
    readonly state: TiktokPublishState
    /** TikTok's own status word (`PROCESSING_UPLOAD`, `PROCESSING_DOWNLOAD`, `SEND_TO_USER_INBOX`, `PUBLISH_COMPLETE`, `FAILED`). */
    readonly providerStatus: string
    /** TikTok's `fail_reason` once failed, or null. */
    readonly failReason: string | null
    /** The public post ids once published and moderated (TikTok withholds them for a few hours), as text. */
    readonly postIds: ReadonlyArray<string>
}

/** What this creator may post with. */
export interface TiktokCreator {
    /** The creator's username. */
    readonly username: string
    /** The creator's display name. */
    readonly nickname: string
    /** The privacy levels a post may be given. */
    readonly privacyLevelOptions: ReadonlyArray<string>
    /** Whether the creator turned comments off. */
    readonly commentDisabled: boolean
    /** Whether the creator turned duets off. */
    readonly duetDisabled: boolean
    /** Whether the creator turned stitches off. */
    readonly stitchDisabled: boolean
    /** The longest video the creator may post in seconds, or null when none is given. */
    readonly maxVideoPostDurationSec: number | null
}

/** A provider that publishes to TikTok: an asynchronous post, started then polled. */
export interface TiktokPublishPort {
    /** The provider key. */
    readonly provider: string
    /** What the account's creator may post with. */
    creator(connection: ConnectionRecord): Promise<TiktokCreator>
    /** Starts one direct post on one account (a file source is uploaded in chunks before the answer). */
    publish(connection: ConnectionRecord, request: TiktokPublishRequest): Promise<TiktokPublishStarted>
    /** The post as it stands. */
    status(connection: ConnectionRecord, publishId: string): Promise<TiktokPublishStatus>
}
