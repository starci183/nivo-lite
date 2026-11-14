import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { ProviderOperation } from "@modules/integrations/provider-http"

/** The provider segment of the Creatomate level-1 names (`apiSegmentOf("creatomate")`). */
const SEGMENT = "nivo.api.creatomate"

/**
 * Every Creatomate operation NIVO calls, from the official reference. Base `https://api.creatomate.com`; auth: header `Authorization`
 * with the project API key as a bearer token (https://creatomate.com/llms/quick-start.md curl example). `serves` names the generic
 * purposes by their full ids (`TOOL.videoCompose` / `TOOL.videoRenderGet`).
 */
export const CREATOMATE_OPERATIONS: Readonly<Record<"rendersCreate" | "rendersGet", ProviderOperation>> = {
    rendersCreate: {
        api: `${SEGMENT}.renders.create`,
        method: "POST",
        path: "/v2/renders",
        docs: "https://creatomate.com/llms/api.md",
        status: "built",
        serves: TOOL.videoCompose,
    },
    rendersGet: {
        api: `${SEGMENT}.renders.get`,
        method: "GET",
        path: "/v2/renders/{id}",
        docs: "https://creatomate.com/docs/api/reference/get-the-status-of-a-render",
        status: "built",
        serves: TOOL.videoRenderGet,
    },
}
