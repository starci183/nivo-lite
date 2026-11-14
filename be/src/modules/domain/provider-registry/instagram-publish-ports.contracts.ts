import type { ConnectionRecord } from "@modules/domain/connections"

/**
 * THE INSTAGRAM DESTINATION: content publishing to an Instagram professional account, a DOMAIN purpose (`nivo.tool.instagram.media.*`):
 * a media container is created, Instagram processes it, then it is published (`media_publish`). Never a blocking wait: a call answers
 * where the container stands and a later call reads it again. A failure is thrown with what it proves (`withProof`).
 */

/** The kinds of media Instagram content publishing documents. */
export type InstagramMediaType = "image" | "video" | "reels" | "carousel"

/** One item of a carousel: an image or a video by its public address. */
export interface InstagramCarouselItem {
    /** Image or video. */
    readonly kind: "image" | "video"
    /** The public address Meta fetches it from. */
    readonly url: string
}

/** What one media publication is asked for. */
export interface InstagramMediaRequest {
    /** The kind. */
    readonly mediaType: InstagramMediaType
    /** The caption, or null. */
    readonly caption: string | null
    /** The public address of the image, video or reel (not a carousel), or null. */
    readonly mediaUrl: string | null
    /** The items of a carousel (up to 20), empty otherwise. */
    readonly children: ReadonlyArray<InstagramCarouselItem>
    /** An image's alternative text, or null. */
    readonly altText: string | null
    /** Whether the post discloses AI generation, or null to say nothing. */
    readonly aiGenerated: boolean | null
}

/**
 * Where a container stands: `pending` (still processing), `ready` (finished, not yet published), `published`, or `failed` (`ERROR` or
 * `EXPIRED`, never publishable).
 */
export type InstagramPublishState = "pending" | "ready" | "published" | "failed"

/** A container as it stands. */
export interface InstagramContainer {
    /** The container id. */
    readonly containerId: string
    /** Where it stands. */
    readonly state: InstagramPublishState
    /** Instagram's own `status_code` word (`IN_PROGRESS`, `FINISHED`, `PUBLISHED`, `ERROR`, `EXPIRED`). */
    readonly statusCode: string
    /** The published media's id once published, else null. */
    readonly mediaId: string | null
}

/** A provider that publishes to Instagram. */
export interface InstagramPublishPort {
    /** The provider key. */
    readonly provider: string
    /** Creates the container (and its children) and, when it is already finished, publishes it. */
    publish(connection: ConnectionRecord, request: InstagramMediaRequest): Promise<InstagramContainer>
    /** Reads a container created earlier and publishes it when it is finished; any other state is answered as it stands. */
    release(connection: ConnectionRecord, containerId: string): Promise<InstagramContainer>
    /** Reads one container (a pure read). */
    status(connection: ConnectionRecord, containerId: string): Promise<InstagramContainer>
}
