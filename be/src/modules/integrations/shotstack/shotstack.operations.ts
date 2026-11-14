import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { ProviderOperation } from "@modules/integrations/provider-http"

/** The provider segment of the Shotstack level-1 names (`apiSegmentOf("shotstack")`). */
const SEGMENT = "nivo.api.shotstack"

/** The generic purposes the operations serve. */
const VIDEO_COMPOSE = TOOL.videoCompose
const VIDEO_RENDER_GET = TOOL.videoRenderGet

/**
 * Every Shotstack operation NIVO calls, from the official Edit API reference (https://shotstack.io/docs/api/). The base is
 * `https://api.shotstack.io/edit/{version}` with `version` `v1` (production) or `stage` (sandbox); the key goes in header `x-api-key`
 * (https://shotstack.io/docs/api/, "Set the x-api-key header with your provided key for the correct environment").
 */
export const SHOTSTACK_OPERATIONS: Readonly<Record<string, ProviderOperation>> = {
    renderCreate: {
        api: `${SEGMENT}.render.create`,
        method: "POST",
        path: "/{version}/render",
        docs: "https://shotstack.io/docs/api/",
        status: "built",
        serves: VIDEO_COMPOSE,
    },
    renderGet: {
        api: `${SEGMENT}.render.get`,
        method: "GET",
        path: "/{version}/render/{id}",
        docs: "https://shotstack.io/docs/api/",
        status: "built",
        serves: VIDEO_RENDER_GET,
    },
    renderCallback: {
        api: `${SEGMENT}.render.callback`,
        method: "POST",
        path: "{Edit.callback}",
        docs: "https://shotstack.io/docs/guide/architecting-an-application/webhooks/",
        status: "built",
        serves: null,
    },
}
