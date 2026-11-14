import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import type { WorkflowRightsStanding } from "@modules/domain/agent-graphs"
import { INSTALLED } from "@modules/domain/installed-plugins"
import type { ProviderOffer } from "@modules/domain/provider-offer"
import { agentRightsOf, providerHoldersOf, type StepTitleOf } from "./node-right-rollups.policy"

const SUBJECT = Symbol("node-right-rollups.policy: titles")

/** The policy functions, read through the Nest testing module. */
const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { agentRightsOf, providerHoldersOf } }],
    }).compile()
    return moduleRef.get<typeof import("./node-right-rollups.policy")>(SUBJECT)
}

/** A title in both languages. */
interface TitleWords {
    readonly vi: string
    readonly en: string
}

/** A step the app installs: a `defineNode` control node or a template node (every business step since the flip), with its title. */
interface InstalledStep {
    readonly id: string
    readonly title: SpecText
}

/** A step the app installs that declares its title in both languages itself. */
type Titled = InstalledStep & { readonly title: TitleWords }

const isTitled = (node: InstalledStep): node is Titled => !("key" in node.title)

const STEPS: ReadonlyArray<InstalledStep> = [...INSTALLED.nodeInstall().nodes, ...INSTALLED.templateNodes()]
const INSTALL = STEPS.filter(isTitled)
/** Whether the plugin that declares the module of a step id (`<module>.<slug>`) is the core package. */
const isCoreStep = (id: string): boolean => INSTALLED.pluginOfModule(id.split(".")[0] ?? "")?.key === "core"
/** One step of the core package and one step of a plugin, taken from the installation as data. */
const CORE = INSTALL.find((node) => isCoreStep(node.id))
const PLUGIN = INSTALL.find((node) => !isCoreStep(node.id))

/** The title a step's installed node declares: what the capability's titles service answers for it. */
const stepTitleOf: StepTitleOf = (step) => {
    const title = INSTALL.find((node) => node.id === step)?.title
    return title === undefined ? null : { vi: title.vi, en: title.en }
}

/** A workflow whose first node runs the core step, then the plugin step, then a step no installed node is. */
const GRAPH: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "chatbot",
    trigger: { kind: "tag", sources: ["system-event"] },
    triggers: [
        {
            key: "paid",
            source: { kind: "provider", connectionId: null, provider: "sepay", trigger: "transaction.received" },
            conditions: [],
        },
    ],
    grant: { tools: [], effects: [] },
    nodes: [
        { key: "first", kind: "execute", step: CORE?.id ?? "" },
        { key: "second", kind: "execute", step: PLUGIN?.id ?? "" },
        { key: "third", kind: "execute", step: "gone.step" },
    ],
}

const ENTRY = {
    connectionId: "c-zalo",
    operation: "nivo.tool.customer.message.send",
    mode: "auto",
    asked: "auto",
    granted: true,
} as const

const standingOf = builder<WorkflowRightsStanding>({
    workflowId: "wf-1",
    agentId: "agent-1",
    versionId: "wfv-1",
    graph: GRAPH,
    workflowKey: "front-desk",
    workflowName: "Front desk",
    versionNumber: 2,
    entries: [
        { ...ENTRY, nodeKey: "first" },
        { ...ENTRY, nodeKey: "second" },
        { ...ENTRY, nodeKey: "third" },
        { ...ENTRY, nodeKey: "second", connectionId: "c-smtp", operation: "send_email", mode: "ask", asked: "ask" },
    ],
})

const offerOf = builder<ProviderOffer>({ connectionId: "c-zalo", provider: "zalo_oa", api: [], mcp: [], triggers: [] })

const PARTS = {
    closed: [],
    standing: [standingOf()],
    agentNames: new Map([["agent-1", "Chatbot"]]),
    attached: new Set(["agent-1"]),
    deciders: [],
    stepTitleOf,
}

describe("node-right-rollups.policy: every step is named by the title its installed node declares", () => {
    it("the installation holds a titled step of the core package and one of a plugin to prove it on", () => {
        expect(CORE).toBeDefined()
        expect(PLUGIN).toBeDefined()
    })

    it("an agent's rows: a core step and a plugin step carry their declared titles; a step no node is carries none", async () => {
        const subject = await build()

        const page = subject.agentRightsOf({
            agentId: "agent-1",
            attachments: [
                { agentId: "agent-1", connectionId: "c-zalo", provider: "zalo_oa" },
                { agentId: "agent-1", connectionId: "c-smtp", provider: "smtp" },
            ],
            names: new Map(),
            offers: new Map(),
            standing: [standingOf()],
            stepTitleOf,
        })

        expect(page.rows.map((row) => [row.nodeKey, row.operation.id, row.stepTitle])).toEqual([
            ["first", "nivo.tool.customer.message.send", CORE?.title],
            ["second", "nivo.tool.customer.message.send", PLUGIN?.title],
            ["third", "nivo.tool.customer.message.send", null],
            ["second", "send_email", PLUGIN?.title],
        ])
        expect(page.rows.every((row) => row.stepTitle?.vi !== row.nodeKey && row.stepTitle?.en !== row.step)).toBe(true)
    })

    it("an agent's rows: an operation no ability holds (the old `send_email` work action) is a bare write, titled by nothing", async () => {
        const subject = await build()
        const attachments = [
            { agentId: "agent-1", connectionId: "c-zalo", provider: "zalo_oa" },
            { agentId: "agent-1", connectionId: "c-smtp", provider: "smtp" },
        ]
        const parts = { agentId: "agent-1", names: new Map(), offers: new Map(), stepTitleOf }

        const page = subject.agentRightsOf({ ...parts, attachments, standing: [standingOf()] })
        const action = page.rows.find((row) => row.operation.id === "send_email")?.operation

        expect(action).toMatchObject({ kind: "write", title: null })
        // A tool no offer documents is no action: it keeps no title rather than a made one.
        expect(page.rows.find((row) => row.operation.id === "nivo.tool.customer.message.send")?.operation.title).toBeNull()
    })
})

describe("node-right-rollups.policy: the holders name their steps by the title their installed node declares", () => {
    it("a provider's holders: each holding step carries its declared title", async () => {
        const subject = await build()
        const tool = {
            id: "nivo.tool.customer.message.send",
            ability: "customer.send",
            kind: "write" as const,
            effect: null,
            mode: null,
            title: null,
            summary: null,
            description: null,
            parameters: [],
            returns: [],
            operation: null,
        }

        const tab = subject.providerHoldersOf({ ...PARTS, offer: offerOf({ mcp: [tool] }) })

        expect(tab.tools[0]?.holders.map((holder) => [holder.nodeKey, holder.stepTitle])).toEqual([
            ["first", CORE?.title],
            ["second", PLUGIN?.title],
            ["third", null],
        ])
    })

    it("a trigger's holders: the workflow that registers on it, by key, and the step an event starts, by its declared title", async () => {
        const subject = await build()
        const trigger = {
            name: "transaction.received",
            kind: "webhook" as const,
            summary: { vi: "Co giao dich moi", en: "A new transaction" },
            payload: [],
            batching: { mode: "each" as const, maxEvents: null },
            recovery: "reconcile" as const,
            decided: true,
        }
        const offer = offerOf({ connectionId: "c-bank", provider: "sepay", triggers: [trigger] })

        const tab = subject.providerHoldersOf({ ...PARTS, offer })

        expect(tab.triggers[0]?.holders).toEqual([
            {
                agentId: "agent-1",
                agentName: "Chatbot",
                role: "notice",
                workflowId: "wf-1",
                workflowName: "Front desk",
                workflowKey: "front-desk",
                nodeKey: "first",
                step: CORE?.id,
                stepTitle: CORE?.title,
            },
        ])
    })
})
