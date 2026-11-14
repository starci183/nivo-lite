import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { WorkflowRightsStanding } from "@modules/domain/agent-graphs"
import type { ProviderOffer } from "@modules/domain/provider-offer"
import {
    agentRightsOf,
    operationOf,
    providerHoldersOf,
    rightCountsOf,
    templateRequestsOf,
} from "./node-right-rollups.policy"

const SUBJECT = Symbol("node-right-rollups.policy")

/** The policy functions, read through the Nest testing module. */
const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { agentRightsOf, operationOf, providerHoldersOf, rightCountsOf, templateRequestsOf } }],
    }).compile()
    return moduleRef.get<typeof import("./node-right-rollups.policy")>(SUBJECT)
}

type OfferedTool = ProviderOffer["mcp"][number]

const toolOf = builder<OfferedTool>({
    id: "fixture.service.renew",
    kind: "write",
    effect: "money",
    title: { vi: "Gia han", en: "Renew at the supplier" },
    summary: null,
    description: null,
    parameters: [],
    returns: [],
    operation: { method: "POST", path: "/services/{code}/renewals", state: "ready", unsupported: [] },
})

const READ = toolOf({
    id: "fixture.service.expiring",
    kind: "read",
    effect: null,
    title: null,
    operation: null,
})

const offerOf = builder<ProviderOffer>({
    connectionId: "c-crm",
    provider: "openapi",
    api: [
        {
            name: "openapi:info",
            kind: "read",
            shape: "info",
            freshness: "synced",
            summary: null,
            parameters: [],
            returns: [],
        },
    ],
    mcp: [READ, toolOf()],
    triggers: [],
})

const GRAPH: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "webrenew",
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
        { key: "find", kind: "execute", step: "webrenew.find" },
        { key: "renew", kind: "execute", step: "webrenew.renew" },
    ],
}

/** An entry on the CRM account: the node's declared mode on one operation. */
const ENTRY = {
    nodeKey: "find",
    connectionId: "c-crm",
    operation: "",
    mode: "auto",
    asked: "auto",
    granted: true,
} as const

const standingOf = builder<WorkflowRightsStanding>({
    workflowId: "wf-1",
    agentId: "agent-renew",
    versionId: "wfv-1",
    graph: GRAPH,
    workflowKey: "renewal",
    workflowName: "Renew at the supplier",
    versionNumber: 3,
    entries: [
        { ...ENTRY, nodeKey: "find", operation: "fixture.service.expiring" },
        { ...ENTRY, nodeKey: "renew", operation: "fixture.service.renew", mode: "ask", asked: "ask", granted: false },
        { ...ENTRY, nodeKey: "renew", connectionId: "c-zalo", operation: "nivo.tool.customer.message.send", mode: "ask" },
    ],
})

describe("node-right-rollups.policy: an agent's rights page", () => {
    it("lists the attached accounts with the steps that use each, and one row per entry its running nodes ask for", async () => {
        const subject = await build()

        const page = subject.agentRightsOf({
            agentId: "agent-renew",
            attachments: [
                { agentId: "agent-renew", connectionId: "c-crm", provider: "openapi" },
                { agentId: "agent-renew", connectionId: "c-zalo", provider: "zalo_oa" },
                { agentId: "agent-renew", connectionId: "c-bank", provider: "sepay" },
            ],
            names: new Map([
                ["c-crm", "CRM NIVO Web"],
                ["c-zalo", "NIVO OA"],
            ]),
            offers: new Map([["c-crm", offerOf()]]),
            standing: [standingOf()],
            stepTitleOf: () => null,
        })

        expect(
            page.accounts.map((account) => [account.name, account.kind, account.stepsUsing, account.operations.length]),
        ).toEqual([
            ["CRM NIVO Web", "records", 2, 2],
            ["NIVO OA", "messaging", 1, 0],
            ["", "payment", 0, 0],
        ])
        expect(
            page.rows.map((row) => [
                row.operation.id,
                row.operation.method,
                row.mode,
                row.workflowName,
                row.nodeKey,
                row.step,
            ]),
        ).toEqual([
            ["fixture.service.expiring", null, "auto", "Renew at the supplier", "find", "webrenew.find"],
            ["fixture.service.renew", "POST", "ask", "Renew at the supplier", "renew", "webrenew.renew"],
            ["nivo.tool.customer.message.send", null, "ask", "Renew at the supplier", "renew", "webrenew.renew"],
        ])
        // A row names the node's one declared mode and the version that runs it: nothing waits for anybody.
        expect(page.rows.map((row) => [row.mode, row.versionNumber])).toEqual([
            ["auto", 3],
            ["ask", 3],
            ["ask", 3],
        ])
    })

    it("names an operation by what its offer declares", async () => {
        const subject = await build()

        expect(subject.operationOf(toolOf())).toEqual({
            id: "fixture.service.renew",
            title: { vi: "Gia han", en: "Renew at the supplier" },
            method: "POST",
            path: "/services/{code}/renewals",
            kind: "write",
            effect: "money",
        })
    })
})

/** What both cases of the tab are made of, beside the offer of the account. */
const PARTS = {
    closed: [{ operationId: "ticket.delete", method: "DELETE", path: "/tickets/{id}" }],
    standing: [
        standingOf(),
        standingOf({ workflowId: "wf-2", agentId: "agent-books", workflowName: "Books", entries: [] }),
    ],
    agentNames: new Map([
        ["agent-renew", "Renewals"],
        ["agent-books", "Books"],
    ]),
    attached: new Set(["agent-renew", "agent-books"]),
    deciders: [{ name: "transaction.received", agentId: "agent-books" }],
    stepTitleOf: () => null,
}

describe("node-right-rollups.policy: a provider's rights tab", () => {
    it("lists every right of the provider, held or not, open or not, with its holders down to the step and the tab figures", async () => {
        const subject = await build()

        const tab = subject.providerHoldersOf({ ...PARTS, offer: offerOf() })

        expect(tab.tools.map((row) => [row.operation.id, row.open, row.holders.length])).toEqual([
            ["fixture.service.expiring", true, 1],
            ["fixture.service.renew", true, 1],
            ["ticket.delete", false, 0],
        ])
        expect(tab.tools[1]?.holders).toEqual([
            {
                agentId: "agent-renew",
                agentName: "Renewals",
                workflowId: "wf-1",
                workflowKey: "renewal",
                workflowName: "Renew at the supplier",
                nodeKey: "renew",
                step: "webrenew.renew",
                stepTitle: null,
                mode: "ask",
                versionNumber: 3,
            },
        ])
        expect(tab.tools[2]?.operation).toMatchObject({
            method: "DELETE",
            path: "/tickets/{id}",
            kind: "write",
            effect: null,
        })
        expect(tab.counts).toEqual({ all: 3, held: 2, unheld: 1, writes: 2 })
        expect(tab.screens).toEqual([{ name: "openapi:info", summary: null, everyMember: true }])
    })
})

/** Where an event of the trigger starts either workflow: the first node of the graph both run. */
const STARTS = { workflowKey: "renewal", nodeKey: "find", step: "webrenew.find", stepTitle: null }

describe("node-right-rollups.policy: the triggers of a provider", () => {
    it("names the agents a trigger wakes: the bound decider, and each attached agent whose running workflow registers on it", async () => {
        const subject = await build()
        const summary = { vi: "Co giao dich moi", en: "A new transaction" }
        const trigger = {
            name: "transaction.received",
            kind: "webhook" as const,
            summary,
            payload: [],
            batching: { mode: "each" as const, maxEvents: null },
            recovery: "reconcile" as const,
            decided: true,
        }
        const offer = offerOf({ connectionId: "c-bank", provider: "sepay", mcp: [], api: [], triggers: [trigger] })

        const tab = subject.providerHoldersOf({ ...PARTS, offer })

        expect(tab.triggers).toEqual([
            {
                name: "transaction.received",
                summary,
                holders: [
                    {
                        agentId: "agent-renew",
                        agentName: "Renewals",
                        role: "notice",
                        workflowId: "wf-1",
                        workflowName: "Renew at the supplier",
                        ...STARTS,
                    },
                    {
                        agentId: "agent-books",
                        agentName: "Books",
                        role: "decider",
                        workflowId: "wf-2",
                        workflowName: "Books",
                        ...STARTS,
                    },
                ],
            },
        ])
        const unbound = subject.providerHoldersOf({
            ...PARTS,
            offer,
            standing: [],
            deciders: [{ name: "transaction.received", agentId: "agent-x" }],
        })
        expect(unbound.triggers[0]?.holders).toEqual([
            {
                agentId: "agent-x",
                agentName: "",
                role: "decider",
                workflowId: null,
                workflowName: null,
                workflowKey: null,
                nodeKey: null,
                step: null,
                stepTitle: null,
            },
        ])
        expect(tab.counts).toEqual({ all: 1, held: 0, unheld: 1, writes: 1 })
    })
})

describe("node-right-rollups.policy: no work action", () => {
    it("lists no work action: an account's rights are its offer's tools alone (a held `send_email` row has nothing to list)", async () => {
        const subject = await build()
        const mail = {
            ...ENTRY,
            nodeKey: "renew",
            connectionId: "c-smtp",
            operation: "send_email",
            mode: "ask",
            asked: "ask",
        } as const
        const offer = offerOf({ connectionId: "c-smtp", provider: "smtp", mcp: [], api: [] })

        const tab = subject.providerHoldersOf({ ...PARTS, closed: [], standing: [standingOf({ entries: [mail] })], offer })

        expect(tab.tools).toEqual([])
        expect(tab.counts).toEqual({ all: 0, held: 0, unheld: 0, writes: 0 })
    })
})

describe("node-right-rollups.policy: what a template asks for before install", () => {
    it("lists each operation its nodes ask for with the mode each node declares", async () => {
        const subject = await build()
        const send = "nivo.tool.customer.message.send"
        const mail = "nivo.tool.mail.message.send"
        const graph: Pick<GraphSpec, "nodes"> = {
            nodes: [
                {
                    key: "answer",
                    kind: "execute",
                    step: "chatbot.answer",
                    accounts: [
                        { kind: "messaging", provider: null, connectionId: null, operations: { [send]: "auto" } },
                    ],
                },
                {
                    key: "books",
                    kind: "execute",
                    step: "accounting.post-payment",
                    accounts: [
                        {
                            kind: "books",
                            provider: "google",
                            connectionId: null,
                            // Asked on `ask` because the template's node declares it.
                            operations: { "nivo.tool.ledger.entry.append": "ask", "nivo.tool.ledger.entry.void": "ask" },
                        },
                        { kind: "mail", provider: null, connectionId: null, operations: { [mail]: "ask" } },
                    ],
                },
                { key: "old", kind: "execute", step: "chatbot.answer" },
            ],
        }

        const asked = subject.templateRequestsOf("accounting.reconcile", 6, graph)

        expect(
            asked.rights.map((row) => [row.nodeKey, row.kind, row.operation, row.mode]),
        ).toEqual([
            ["answer", "messaging", send, "auto"],
            ["books", "books", "nivo.tool.ledger.entry.append", "ask"],
            ["books", "books", "nivo.tool.ledger.entry.void", "ask"],
            ["books", "mail", mail, "ask"],
        ])
        expect([asked.templateId, asked.version, asked.count, asked.askCount]).toEqual(["accounting.reconcile", 6, 4, 3])
        expect(subject.templateRequestsOf("x", 1, { nodes: [] })).toMatchObject({ rights: [], count: 0 })
    })
})
