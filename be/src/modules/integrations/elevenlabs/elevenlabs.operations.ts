import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { ProviderOperation } from "@modules/integrations/provider-http"

/** The provider segment of ElevenLabs' level-1 names (`apiSegmentOf("elevenlabs")`). */
const SEGMENT = "nivo.api.elevenlabs"

/**
 * Every ElevenLabs operation NIVO calls, from the official API reference (auth: header `xi-api-key`,
 * https://elevenlabs.io/docs/api-reference/authentication). The level-1 names are the source of truth for the modules that move onto
 * them; the purposes are the generic tools that serve them to nodes.
 */
export const ELEVENLABS_OPERATIONS = {
    textToSpeechConvert: {
        api: `${SEGMENT}.text-to-speech.convert`,
        method: "POST",
        path: "/v1/text-to-speech/{voice_id}",
        docs: "https://elevenlabs.io/docs/api-reference/text-to-speech/convert",
        status: "built",
        serves: TOOL.speechGenerate,
    },
    voicesSearch: {
        api: `${SEGMENT}.voices.search`,
        method: "GET",
        path: "/v2/voices",
        docs: "https://elevenlabs.io/docs/api-reference/voices/search",
        status: "built",
        serves: TOOL.speechVoiceList,
    },
    dubbingCreate: {
        api: `${SEGMENT}.dubbing.create`,
        method: "POST",
        path: "/v1/dubbing",
        docs: "https://elevenlabs.io/docs/api-reference/dubbing/create",
        status: "built",
        serves: TOOL.dubbingCreate,
    },
    dubbingGet: {
        api: `${SEGMENT}.dubbing.get`,
        method: "GET",
        path: "/v1/dubbing/{dubbing_id}",
        docs: "https://elevenlabs.io/docs/api-reference/dubbing/get",
        status: "built",
        serves: TOOL.dubbingGet,
    },
    dubbingAudioGet: {
        api: `${SEGMENT}.dubbing.audio.get`,
        method: "GET",
        path: "/v1/dubbing/{dubbing_id}/audio/{language_code}",
        docs: "https://elevenlabs.io/docs/api-reference/dubbing/audio/get",
        status: "built",
        serves: null,
    },
} as const satisfies Readonly<Record<string, ProviderOperation>>
