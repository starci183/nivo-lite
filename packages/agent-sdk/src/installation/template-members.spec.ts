import { z } from "zod"
import { SdkDefinitionError } from "../block/definition-error"
import { TRIGGER } from "../names"
import { defineTemplateGraph, node, outcome, trigger } from "../template/builder"
import { defineTemplateAgent } from "../template/builder/template-agent"
import { listOrders, roundReport } from "../template/builder/template.fixture"
import type { WorkflowTemplate } from "../template/workflow-template"
import { defineInstallation } from "./installation"
import { nodeOf } from "./installation.fixture"
import { registryLinesOf } from "./registry-lines"

/** One small template agent of module `test`: one graph placing `listOrders` then an outcome. */
const agentOf = (key = "test", graphKey = "test.listing", version: number | null = null) =>
    defineTemplateAgent({
        key,
        label: { key: "agentTest" },
        accounts: [],
        graphs: [
            defineTemplateGraph({
                key: graphKey,
                title: { key: "graphListing" },
                input: z.object({ preset: z.string() }),
                triggers: [trigger(TRIGGER.clockTick, { args: { preset: "daily" } })],
                start: "list",
                nodes: { list: node(listOrders, { next: "done" }), done: outcome({ name: "done" }) },
                ...(version === null
                    ? {}
                    : {
                          catalogue: {
                              name: { key: "graphListing" },
                              summary: { key: "graphListing" },
                              version,
                              publishedAt: "2026-11-12T00:00:00.000Z",
                              notes: { key: "graphListing" },
                          },
                      }),
            }),
        ],
        primary: graphKey,
    })

/** A legacy workflow template of an id, as small as the installation reads it. */
const legacyTemplateOf = (id: string): WorkflowTemplate => ({
    id,
    moduleKey: id.split(".")[0] ?? "",
    primary: true,
    name: { vi: id, en: id },
    summary: { vi: id, en: id },
    requires: [],
    shops: 0,
    versions: [],
})

const captured = (call: () => unknown): unknown => {
    try {
        call()
    } catch (error) {
        return error
    }
    return undefined
}

describe("the template members of a plugin", () => {
    it("lists the template nodes a part declares and the ones its agents place, once each, and its agents", () => {
        const agent = agentOf()
        const installation = defineInstallation([{ key: "core", templateNodes: [listOrders, roundReport], templateAgents: [agent] }], "h")
        expect(installation.templateNodes.map((one) => one.id)).toEqual([listOrders.id, roundReport.id])
        expect(installation.templateAgents).toEqual([agent])
        const placedOnly = defineInstallation([{ key: "core", templateAgents: [agent] }], "h")
        expect(placedOnly.templateNodes.map((one) => one.id)).toEqual([listOrders.id])
    })

    it("refuses one node id in both forms, a template agent key twice, and a graph key a legacy template holds", () => {
        const twoForms = captured(() =>
            defineInstallation([{ key: "core", nodes: [nodeOf(listOrders.id)] }, { key: "shop", templateNodes: [listOrders] }], "h"),
        )
        expect(twoForms).toEqual(new SdkDefinitionError("INSTALLATION_ID_DUPLICATE", `node:${listOrders.id} (core, shop)`))
        const twoAgents = captured(() =>
            defineInstallation([{ key: "core", templateAgents: [agentOf()] }, { key: "shop", templateAgents: [agentOf("test", "test.other")] }], "h"),
        )
        expect(twoAgents).toEqual(new SdkDefinitionError("INSTALLATION_ID_DUPLICATE", "template-agent:test (core, shop)"))
        const heldId = captured(() =>
            defineInstallation(
                [{ key: "core", templates: [legacyTemplateOf("test.listing")] }, { key: "shop", templateAgents: [agentOf("other", "other.listing"), agentOf()] }],
                "h",
            ),
        )
        expect(heldId).toEqual(new SdkDefinitionError("INSTALLATION_ID_DUPLICATE", "template:test.listing (core, shop)"))
    })

    it("refuses two different definitions of one template node id", () => {
        const twin = { ...listOrders }
        expect(captured(() => defineInstallation([{ key: "core", templateNodes: [listOrders, twin] }], "h"))).toEqual(
            new SdkDefinitionError("INSTALLATION_ID_DUPLICATE", `node:${listOrders.id}`),
        )
    })

    it("gives every template node, agent and graph a registry line, and none to a part that declares none", () => {
        const lines = registryLinesOf([{ key: "core", templateAgents: [agentOf()] }])
        expect(lines).toEqual(
            expect.arrayContaining([`template-node:${listOrders.id}@0`, "template-agent:test@0", "template-graph:test.listing@1"]),
        )
        expect(registryLinesOf([{ key: "core" }]).filter((line) => line.startsWith("template-"))).toEqual([])
        const installation = defineInstallation([{ key: "core", templateAgents: [agentOf()] }], "h")
        expect(registryLinesOf([installation])).toEqual(lines)
    })

    it("carries a graph's catalogue version in its line (1 without a catalogue), so a new version of a graph changes the hash", () => {
        const graphLines = (version: number | null): ReadonlyArray<string> =>
            registryLinesOf([{ key: "core", templateAgents: [agentOf("test", "test.listing", version)] }]).filter((line) =>
                line.startsWith("template-graph:"),
            )
        expect(graphLines(null)).toEqual(["template-graph:test.listing@1"])
        expect(graphLines(1)).toEqual(["template-graph:test.listing@1"])
        expect(graphLines(3)).toEqual(["template-graph:test.listing@3"])
        expect(registryLinesOf([{ key: "core", templateAgents: [agentOf("test", "test.listing", 3)] }])).not.toEqual(
            registryLinesOf([{ key: "core", templateAgents: [agentOf("test", "test.listing", 2)] }]),
        )
    })
})
