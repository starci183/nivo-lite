import { defineInstallation } from "@nivo-lite/agent-sdk/installation"
import { BASE_NODE_ID, BASE_PLUGIN } from "@tests/fixtures/builders/base-plugin.builder"
import { CORE_AGENT, CORE_INBOX } from "@tests/fixtures/builders/engine-core-plugin.builder"
import { TMPL_AGENT_TEMPLATE, TMPL_PLUGIN, noteNode } from "@tests/fixtures/builders/template-plugin.builder"
import { installedPluginsOf } from "./installed-plugins.policy"

describe("the template members as the engine asks for them", () => {
    const installed = installedPluginsOf(defineInstallation([BASE_PLUGIN, TMPL_PLUGIN], "h"))
    const coreOnly = installedPluginsOf(defineInstallation([BASE_PLUGIN], "h"))

    it("finds a template node, agent and graph by id, and nothing for a defineNode node", () => {
        expect(installed.templateNodeOf(noteNode.id)).toBe(noteNode)
        expect(installed.templateNodeOf(BASE_NODE_ID)).toBeNull()
        expect(installed.templateAgentOf("tmpl")).toBe(TMPL_AGENT_TEMPLATE)
        expect(installed.templateGraphOf("tmpl.followup")?.agent).toBe(TMPL_AGENT_TEMPLATE)
        // The first plugin ships its graphs as template agents too (the flip): its inbox is a template graph of its own agent.
        expect(installed.templateGraphOf(CORE_INBOX)?.agent.key).toBe(CORE_AGENT)
        expect(installed.templateGraphOf("nobody.none")).toBeNull()
        expect(installed.templateNodes().map((node) => node.id)).toEqual([
            ...coreOnly.templateNodes().map((node) => node.id),
            "tmpl.triage",
            "tmpl.order-note",
            "tmpl.rogue",
        ])
    })

    it("lists each template graph after the shipped templates, by module and by id, the same object every time", () => {
        const ids = installed.templates().map((template) => template.id)
        expect(ids.slice(-2)).toEqual(["tmpl.intake", "tmpl.followup"])
        expect(installed.templatesOf("tmpl").map((template) => template.id)).toEqual(["tmpl.intake", "tmpl.followup"])
        expect(installed.templateOf("tmpl.intake")).toBe(installed.templates().at(-2))
        expect(installed.templateOf(CORE_INBOX)?.moduleKey).toBe(CORE_AGENT)
    })
})
