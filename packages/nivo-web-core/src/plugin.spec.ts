import { defineInstallation } from "@nivo-lite/agent-sdk/installation"
import { DEFAULT_AI_READ_TOOLS, DEFAULT_NODE_TOOLS, TOOL } from "@nivo-lite/agent-sdk/names"
import * as root from "./index"
import { plugin } from "./plugin"
import { crmTools } from "./vocabulary/crm-tools"
import { CRM_NIVOWEB } from "./crm/nivoweb/api.generated"

/** The six agents of the plugin, in catalogue order, each with its graphs (the workflow templates the engine installs), primary first. */
const AGENTS: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
    ["webmail", ["webmail.triage", "webmail.team-chat"]],
    ["webdocs", ["webdocs.draft", "webdocs.team-chat"]],
    ["webdesk", ["webdesk.front", "webdesk.ticket", "webdesk.mail-tickets", "webdesk.team-chat"]],
    [
        "webrenew",
        ["webrenew.round", "webrenew.answer", "webrenew.mail-replies", "webrenew.renew", "webrenew.team-chat"],
    ],
    [
        "webbooks",
        [
            "webbooks.invoice",
            "webbooks.payment",
            "webbooks.debt-round",
            "webbooks.supplier-invoices",
            "webbooks.team-chat",
        ],
    ],
    [
        "websales",
        [
            "websales.round",
            "websales.enquiry",
            "websales.close",
            "websales.link",
            "websales.mail-enquiries",
            "websales.won",
            "websales.team-chat",
        ],
    ],
]

/** Every node the plugin's graphs place, once. */
const placed = [
    ...new Set(
        (plugin.templateAgents ?? []).flatMap((agent) => agent.graphs.flatMap((graph) => [...graph.nodes.values()])),
    ),
]
const OWN = new Set(AGENTS.map(([key]) => key))
/** True for a node of this plugin (its id's module is one of the plugin's). */
const ownNode = (id: string): boolean => OWN.has(id.split(".")[0] ?? "")

describe("the nivo-web-core plugin", () => {
    it("is private to the enterprise nivo-web, under its own key and label", () => {
        expect(plugin).toMatchObject({
            key: "nivo-web-core",
            label: { vi: "Nivo Web", en: "Nivo Web" },
            visibility: "private",
            enterprises: ["nivo-web"],
        })
    })

    it("joins an installation alone as one closed plugin that brings its template agents and its CRM source's tools, naming the platform tools", () => {
        const installed = defineInstallation([plugin], "")

        expect(installed.plugins).toEqual([
            {
                key: "nivo-web-core",
                label: { vi: "Nivo Web", en: "Nivo Web" },
                visibility: "private",
                enterprises: ["nivo-web"],
                modules: AGENTS.map(([key]) => key),
                providers: ["nivoweb"],
                // The plugin names its package (records frame: the first part of every record type and read it declares).
                packageName: "nivo-web-core",
            },
        ])
        expect(installed.templateAgents.map((agent) => [agent.key, agent.graphs.map((graph) => graph.key)])).toEqual(
            AGENTS,
        )
        expect(installed.templateAgents.map((agent) => agent.primary)).toEqual(AGENTS.map(([, graphs]) => graphs[0]))
        // No legacy form is left: no `defineNode` node and no JSON workflow template; every node is a template node its graphs place.
        expect([installed.nodes, installed.templates]).toEqual([[], []])
        expect(installed.templateNodes.map((node) => node.id).sort()).toEqual(placed.map((node) => node.id).sort())
        // The CRM source's tools are the plugin's own contract; the platform tools its nodes call (the mail and e-invoice reads, the
        // customer link) it only names: the engine defines them (be `tool-specs/native-tool-definitions.policy.ts`, whose spec holds
        // that every reader of the installation still knows them).
        expect(installed.tools.map((tool) => tool.id)).toEqual(crmTools.map((tool) => tool.id))
        expect(
            installed.tools.filter((tool) =>
                [
                    "nivo.tool.mail.message.list",
                    "nivo.tool.mail.message.get",
                    "nivo.tool.einvoice.list",
                    "nivo.tool.einvoice.get",
                    "nivo.tool.contact.identity.link",
                ].includes(tool.id),
            ),
        ).toEqual([])
        expect(installed.providers.map((template) => template.id)).toEqual(["nivoweb"])
        expect([installed.effects, installed.jobs, installed.entities, installed.blocks]).toEqual([[], [], [], []])
        // The four customer purposes and the invoice are the core's tools, words and labels: never declared here.
        expect(Object.keys(installed.toolLabels).sort()).toEqual(
            crmTools
                .map((tool) => tool.id)
                .filter((id) => id !== TOOL.invoiceCreate)
                .sort(),
        )
        expect(installed.tools.map((tool) => tool.id)).toContain(CRM_NIVOWEB.get_customers)
        expect(Object.keys(installed.messages)).toEqual(AGENTS.map(([key]) => key))
    })

    it("holds a weight row for exactly its own nodes that call AI, and none for a node that calls no AI or is another package's", () => {
        const ai = placed.filter((node) => ownNode(node.id) && node.model !== undefined).map((node) => node.id)

        expect(Object.keys(plugin.nodeModels ?? {}).sort()).toEqual([...ai].sort())
        expect(Object.values(plugin.nodeModels ?? {}).filter((row) => row.model !== "auto")).toEqual([])
        // The four chat turns are booked as chat turns, as before the flip.
        const turns = Object.entries(plugin.nodeModels ?? {}).flatMap(([id, row]) =>
            row.work === "chat_turn" ? [id] : [],
        )
        expect(turns.sort()).toEqual([
            "webbooks.team-answer",
            "webdesk.team-answer",
            "webrenew.team-answer",
            "websales.team-answer",
        ])
    })

    it("gives each agent's declaration exactly the tools the nodes of its graphs list, the two default sets apart (the engine adds them)", () => {
        const defaults = new Set<string>([...DEFAULT_AI_READ_TOOLS, ...DEFAULT_NODE_TOOLS])
        for (const agent of plugin.templateAgents ?? []) {
            const declared = (plugin.modules ?? []).find((module) => module.key === agent.key)?.agent?.tools ?? []
            const called = [
                ...new Set(
                    agent.graphs.flatMap((graph) => [...graph.nodes.values()].flatMap((node) => [...node.tools])),
                ),
            ].filter((tool) => !defaults.has(tool))

            expect([agent.key, [...declared].sort()]).toEqual([agent.key, called.sort()])
        }
    })

    it("gives every CRM tool owner words in both languages and model words for its title", () => {
        const installed = defineInstallation([plugin], "")
        for (const id of crmTools.map((tool) => tool.id).filter((one) => one !== TOOL.invoiceCreate)) {
            const tool = installed.tools.find((one) => one.id === id)
            const title = tool?.title
            expect(title !== undefined && "key" in title ? installed.wordsOf(title.key) : undefined).toEqual(
                expect.any(String),
            )
            expect(installed.toolLabels[id]?.title.vi).toEqual(expect.any(String))
        }
    })

    it("exports from its root only the plugin the registry generator reads", () => {
        expect(Object.keys(root)).toEqual(["plugin"])
        expect(root.plugin).toBe(plugin)
    })
})
