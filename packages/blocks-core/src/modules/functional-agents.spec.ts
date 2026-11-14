import { DEFAULT_AI_READ_TOOLS, DEFAULT_NODE_TOOLS } from "@nivo-lite/agent-sdk/names"
import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import type { TemplateAgent } from "@nivo-lite/agent-sdk/template"
import { MODULE_CRAFT, agentGuidanceOf } from "./agent-guidance"
import { TRUTH_FIRST } from "./agent-policy"
import { bookingModule } from "./booking"
import { bookingAgent } from "./booking/template/booking.agent"
import { hiringModule } from "./hiring"
import { hiringAgent } from "./hiring/template/hiring.agent"
import { mindsetBrief } from "./mindset"
import { videoModule } from "./video"
import { videoAgent } from "./video/template/video.agent"

const AGENTS: ReadonlyArray<readonly [ModuleDeclaration, TemplateAgent]> = [
    [bookingModule, bookingAgent],
    [hiringModule, hiringAgent],
    [videoModule, videoAgent],
]

describe.each(AGENTS)("the agent of the %s module", (module, agent) => {
    it("shares its key with the template agent", () => {
        expect(agent.key).toBe(module.key)
    })

    it("holds every tool a node of its graphs calls (the record, file, timer and AI read defaults aside)", () => {
        const held = new Set<string>([...(module.agent?.tools ?? []), ...DEFAULT_NODE_TOOLS, ...DEFAULT_AI_READ_TOOLS])
        const outside = agent.graphs.flatMap((graph) =>
            [...graph.nodes.values()].flatMap((node) => node.tools.filter((tool) => !held.has(tool)).map((tool) => `${graph.key}:${node.id}:${tool}`)),
        )
        expect(outside).toEqual([])
    })

    it.each(["vi", "en"] as const)("works under the shared truth-first rule and its own words in %s", (locale) => {
        const guidance = agentGuidanceOf(module.key, locale)
        expect(guidance).toContain(TRUTH_FIRST[locale])
        expect(guidance).toContain(MODULE_CRAFT[module.key]?.[locale])
    })

    it("reads its base mindset after its craft words", () => {
        expect(mindsetBrief(module.key)).not.toBe("")
        expect(agentGuidanceOf(module.key, "vi")).toContain(mindsetBrief(module.key))
    })
})
