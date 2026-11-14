import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { ProviderOperation } from "@modules/integrations/provider-http"

/** The provider segment of the Veo level-1 names (`apiSegmentOf("veo")`). */
const SEGMENT = "nivo.api.veo"

/**
 * Every Veo operation NIVO calls, from the official Gemini API Veo guide (https://aistudio.google.com/docs/veo; auth: header
 * `x-goog-api-key`). The operation resource is the Gemini API's long-running operation (`name`, `done`, `error`, `response`:
 * https://aistudio.google.com/api-reference/batch-api/get-batch.md).
 */
export const VEO_OPERATIONS: Readonly<Record<string, ProviderOperation>> = {
    modelsPredictLongRunning: {
        api: `${SEGMENT}.models.predict-long-running`,
        method: "POST",
        path: "/models/{model}:predictLongRunning",
        docs: "https://aistudio.google.com/docs/veo",
        status: "built",
        serves: TOOL.videoGenerate,
    },
    operationsGet: {
        api: `${SEGMENT}.operations.get`,
        method: "GET",
        path: "/{operation name}",
        docs: "https://aistudio.google.com/docs/veo",
        status: "built",
        serves: TOOL.videoGenerationGet,
    },
    filesDownload: {
        api: `${SEGMENT}.files.download`,
        method: "GET",
        path: "{generatedSamples[].video.uri}",
        docs: "https://aistudio.google.com/docs/veo",
        status: "built",
        serves: null,
    },
}
