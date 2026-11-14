import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { ProviderOperation } from "@modules/integrations/provider-http"

/** The provider segment of the TikTok level-1 names (`apiSegmentOf("tiktok")`). */
const SEGMENT = "nivo.api.tiktok"

/**
 * Every TikTok operation NIVO calls, from the official Content Posting API documentation (base `https://open.tiktokapis.com`; every call
 * but the chunk upload sends `Authorization: Bearer {user access token}`; the token needs scope `video.publish`). `serves` is the
 * destination tool the operation backs (a `TOOL` constant).
 */
export const TIKTOK_OPERATIONS: Readonly<Record<string, ProviderOperation>> = {
    creatorInfoQuery: {
        api: `${SEGMENT}.creator-info.query`,
        method: "POST",
        path: "/v2/post/publish/creator_info/query/",
        docs: "https://developers.tiktok.com/doc/content-posting-api-reference-query-creator-info",
        status: "built",
        serves: TOOL.tiktokCreatorInfoGet,
    },
    videoInit: {
        api: `${SEGMENT}.video.init`,
        method: "POST",
        path: "/v2/post/publish/video/init/",
        docs: "https://developers.tiktok.com/doc/content-posting-api-reference-direct-post",
        status: "built",
        serves: TOOL.tiktokVideoPublish,
    },
    videoUpload: {
        api: `${SEGMENT}.video.upload`,
        method: "PUT",
        path: "{data.upload_url}",
        docs: "https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide",
        status: "built",
        serves: TOOL.tiktokVideoPublish,
    },
    statusFetch: {
        api: `${SEGMENT}.status.fetch`,
        method: "POST",
        path: "/v2/post/publish/status/fetch/",
        docs: "https://developers.tiktok.com/doc/content-posting-api-reference-get-video-status",
        status: "built",
        serves: TOOL.tiktokVideoStatusGet,
    },
    oauthTokenRefresh: {
        api: `${SEGMENT}.oauth.token.refresh`,
        method: "POST",
        path: "/v2/oauth/token/",
        docs: "https://developers.tiktok.com/doc/oauth-refresh-a-user-access-token",
        status: "built",
        serves: null,
    },
}
