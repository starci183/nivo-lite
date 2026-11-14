import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { ProviderOperation } from "@modules/integrations/provider-http"

/** The provider segment of the JSON2Video level-1 names (`apiSegmentOf("json2video")`). */
const SEGMENT = "nivo.api.json2video"

/**
 * Every JSON2Video operation NIVO calls, from the official API reference. Auth: header `x-api-key` on both
 * (https://json2video.com/docs/v2/reference/api-endpoints/movies-create). The render's completion arrives by the movie's own
 * `exports[].destinations[]` webhook (https://json2video.com/docs/v2/reference/webhooks), which NIVO receives, not calls.
 */
export const JSON2VIDEO_OPERATIONS: Readonly<Record<string, ProviderOperation>> = {
    moviesCreate: {
        api: `${SEGMENT}.movies.create`,
        method: "POST",
        path: "/movies",
        docs: "https://json2video.com/docs/v2/reference/api-endpoints/movies-create",
        status: "built",
        serves: TOOL.videoCompose,
    },
    moviesGet: {
        api: `${SEGMENT}.movies.get`,
        method: "GET",
        path: "/movies?project={project}",
        docs: "https://json2video.com/docs/v2/reference/api-endpoints/movies-status",
        status: "built",
        serves: TOOL.videoRenderGet,
    },
}
