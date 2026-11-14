import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { ProviderOperation } from "@modules/integrations/provider-http"

/** The provider segment of the Meta level-1 names (`apiSegmentOf("meta")`). */
const SEGMENT = "nivo.api.meta"

/** The operations of the table, by name. */
type MetaPublishingOperationName =
    | "pageFeedCreate"
    | "pagePhotosCreate"
    | "pageVideosCreate"
    | "instagramMediaCreate"
    | "instagramMediaPublish"
    | "instagramContainerStatus"

/**
 * Every Meta publishing operation NIVO calls (Graph API; the token rides as the `access_token` field of a POST, https://developers.facebook.com/docs/graph-api/reference/page/feed/,
 * and as `Authorization: Bearer` on the status GET, https://developers.facebook.com/docs/instagram-platform/content-publishing).
 * `serves` carries the DOMAIN tool ids as `TOOL` constants.
 * Left out on purpose: `GET /<IG_ID>/content_publishing_limit` (the page names it but lists no response member) and the resumable
 * `rupload.facebook.com` upload (its parameter list is truncated in the documentation): neither is called.
 */
export const META_PUBLISHING_OPERATIONS: Readonly<Record<MetaPublishingOperationName, ProviderOperation>> = {
    pageFeedCreate: {
        api: `${SEGMENT}.page.feed.create`,
        method: "POST",
        path: "/{page-id}/feed",
        docs: "https://developers.facebook.com/docs/graph-api/reference/page/feed/",
        status: "built",
        serves: TOOL.facebookPostPublish,
    },
    pagePhotosCreate: {
        api: `${SEGMENT}.page.photos.create`,
        method: "POST",
        path: "/{page-id}/photos",
        docs: "https://developers.facebook.com/docs/graph-api/reference/page/photos/",
        status: "built",
        serves: TOOL.facebookPostPublish,
    },
    pageVideosCreate: {
        api: `${SEGMENT}.page.videos.create`,
        method: "POST",
        path: "/{page-id}/videos",
        docs: "https://developers.facebook.com/docs/graph-api/reference/page/videos/",
        status: "built",
        serves: TOOL.facebookPostPublish,
    },
    instagramMediaCreate: {
        api: `${SEGMENT}.instagram.media.create`,
        method: "POST",
        path: "/{ig-id}/media",
        docs: "https://developers.facebook.com/docs/instagram-platform/content-publishing",
        status: "built",
        serves: TOOL.instagramMediaPublish,
    },
    instagramMediaPublish: {
        api: `${SEGMENT}.instagram.media-publish.create`,
        method: "POST",
        path: "/{ig-id}/media_publish",
        docs: "https://developers.facebook.com/docs/instagram-platform/content-publishing",
        status: "built",
        serves: TOOL.instagramMediaPublish,
    },
    instagramContainerStatus: {
        api: `${SEGMENT}.instagram.container.get`,
        method: "GET",
        path: "/{container-id}?fields=status_code",
        docs: "https://developers.facebook.com/docs/instagram-platform/content-publishing",
        status: "built",
        serves: TOOL.instagramMediaStatusGet,
    },
} as const satisfies Readonly<Record<string, ProviderOperation>>
