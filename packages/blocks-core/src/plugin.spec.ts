import { defineInstallation } from "@nivo-lite/agent-sdk/installation"
import { FLOW_F_ENTITIES } from "./shared/entities/flow-f.entities"
import { modelWordsOf } from "./shared/messages/catalog"
import { agentGuidanceOf } from "./shared/agent/agent-guidance"
import { MODULE_DECLARATIONS } from "./shared/modules/module-declarations"
import { MODULE_JOBS } from "./shared/modules/module-jobs"
import { chatbotAgent } from "./agents/chatbot/graphs/chatbot.agent"
import { salesAgent } from "./agents/sales/graphs/sales.agent"
import { coreControlNodes } from "./shared/nodes/node-lists"
import { coreDataKinds } from "./shared/vocabulary/data-kinds"
import { coreEffects } from "./shared/vocabulary/effects"
import { TOOL_LABELS } from "./shared/vocabulary/tool-labels"
import { coreTools } from "./shared/vocabulary/tools"
import { corePlugin } from "./plugin"

// This package alone as an installation (`[corePlugin]`): what the engine reads through the installed array is exactly what the package
// declares. (The engine's own specs read the array through a neutral fixture plugin and import no package by name.)
describe("corePlugin read through an installation of it alone", () => {
    const installation = defineInstallation([corePlugin], "core-only")

    it("is the one public plugin keyed core, its entities and jobs in the order the package declares them", () => {
        expect(installation.plugins.map((plugin) => [plugin.key, plugin.visibility, plugin.packageName])).toEqual([
            ["core", "public", "blocks-core"],
        ])
        expect(installation.entities.map((entity) => entity.name)).toEqual(FLOW_F_ENTITIES.map((entity) => entity.name))
        expect(installation.jobs.map((job) => job.name)).toEqual(MODULE_JOBS.map((job) => job.name))
        expect(installation.jobs.length).toBeGreaterThan(0)
    })

    it("holds the template agents, nodes, effects, tools and data kinds exactly as the package exports them", () => {
        for (const agent of [chatbotAgent, salesAgent]) expect(installation.templateAgents).toContainEqual(agent)
        expect(installation.nodes).toEqual(coreControlNodes)
        expect(installation.effects).toEqual(coreEffects)
        expect(installation.tools).toEqual(coreTools)
        expect(installation.dataKinds).toEqual(coreDataKinds)
    })

    it("gives the words of every effect, the labels of every tool and each module's agent and guidance as the package declares them", () => {
        for (const effect of coreEffects) {
            const key = "key" in effect.title ? effect.title.key : ""
            expect(installation.wordsOf(key)).toBe(modelWordsOf(key))
        }
        for (const tool of Object.keys(TOOL_LABELS)) expect(installation.toolLabels[tool]).toBe(TOOL_LABELS[tool])
        for (const module of MODULE_DECLARATIONS) {
            expect(installation.modules).toContain(module)
            expect(installation.guidanceOf(module.key, "vi")).toBe(agentGuidanceOf(module.key, "vi"))
            expect(installation.guidanceOf(module.key, "en")).toBe(agentGuidanceOf(module.key, "en"))
        }
    })
})
