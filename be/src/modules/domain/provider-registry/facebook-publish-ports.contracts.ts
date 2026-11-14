import type { ConnectionRecord } from "@modules/domain/connections"

/**
 * THE FACEBOOK DESTINATION: publishing to a Facebook Page, a DOMAIN purpose (`nivo.tool.facebook.post.publish`), never a generic one: its
 * contract is Facebook's own (message, link, one photo or video), and a failure is never retried on another destination. A provider
 * account that reaches Facebook (`meta`) implements the port and registers it under its provider key. A failure is thrown with what it
 * proves (`withProof`); an answered refusal is a `providerRefusal` (a `ProviderRegistryError`).
 */

/** The media a Facebook post carries: one photo or one video by its public address (the Page photo / video edges take `url` / `file_url`). */
export interface FacebookPostMedia {
    /** Which edge: a photo or a video. */
    readonly kind: "photo" | "video"
    /** The public https address Meta fetches the file from. */
    readonly url: string
    /** The video's title (a video only), or null. */
    readonly title: string | null
}

/** What one Page post is asked for. */
export interface FacebookPostRequest {
    /** The text: the post's message, a photo's caption or a video's description; null when the post is a bare link. */
    readonly message: string | null
    /** A link the post attaches (no media with it), or null. */
    readonly link: string | null
    /** One photo or video, or null for a text / link post. */
    readonly media: FacebookPostMedia | null
}

/** A Page post as Facebook answered it. */
export interface FacebookPostResult {
    /** Which edge made it. */
    readonly kind: "text" | "link" | "photo" | "video"
    /** The post's id (`id` of a feed post, `post_id` of a photo); null when Facebook answered none (a video). */
    readonly postId: string | null
    /** The photo's or video's own object id, or null for a text / link post. */
    readonly mediaId: string | null
}

/** A provider that publishes to Facebook Pages: one synchronous call. */
export interface FacebookPublishPort {
    /** The provider key. */
    readonly provider: string
    /** Publishes one post to the Page of the account. */
    publish(connection: ConnectionRecord, request: FacebookPostRequest): Promise<FacebookPostResult>
}
