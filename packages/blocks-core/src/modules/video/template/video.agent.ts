import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import { type TemplateAgent, defineTemplateAgent } from "@nivo-lite/agent-sdk/template"
import { VIDEO_COPY } from "./copy"
import { videoProduceGraph } from "./produce.graph"

/**
 * The Video agent template: the speech account (ElevenLabs) that reads the script aloud, the video account (Veo) that generates its
 * scenes and the compose services (Shotstack, Creatomate, JSON2Video: ordered alternatives, one is enough) that join the clips, the
 * narration, the captions and the logo into one video, in the order they are attached; its one graph makes that video and stores it
 * with the clips and the narration as files, when another workflow calls it.
 */
export const videoAgent: TemplateAgent = defineTemplateAgent({
    key: "video",
    label: VIDEO_COPY.text("agent.label"),
    accounts: [PROVIDER.elevenlabs, PROVIDER.veo, PROVIDER.shotstack, PROVIDER.creatomate, PROVIDER.json2video],
    graphs: [videoProduceGraph],
    primary: videoProduceGraph.key,
})
