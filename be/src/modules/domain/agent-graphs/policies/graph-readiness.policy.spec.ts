import { Test } from "@nestjs/testing"
import { latestTemplateVersion } from "@nivo-lite/agent-sdk/template"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { PROVIDER_CATALOGUE } from "@modules/domain/tools"
import { OPENAPI_PROVIDER, OPENAPI_SOURCE_KEYS } from "@modules/domain/openapi-tools"
import {
    graphReadinessOf,
    sideNodeWaitingOf,
    type GraphReadiness,
    type ReadinessInput,
    type ReadinessNode,
} from "./graph-readiness.policy"
import { NIVO_PROVIDER, nodeProvidersOf } from "./node-accounts.policy"

/**
 * Readiness, per TOOL: a BLOCKING node with a tool none of whose providers is bound hides its graph; a NON-blocking one is skipped and named; a node that
 * lists no accounts is ready as today. The proof at the end: every installed core and NIVO Web template is ready for an agent
 * attached as `attachDefaults` attaches it, so readiness hides no graph that runs today.
 */

interface Subject {
    readonly readinessOf: typeof graphReadinessOf
    readonly sideOf: typeof sideNodeWaitingOf
}

const SUBJECT = Symbol("graph-readiness.policy")

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { readinessOf: graphReadinessOf, sideOf: sideNodeWaitingOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const SEND = TOOL.customerMessageSend

/** A blocking `@2` send node with two alternatives. */
const say: ReadinessNode = {
    key: "say",
    step: "sales.reply",
    accounts: [
        { provider: "zalo_oa", operations: { [SEND]: "auto" } },
        { provider: "telegram", operations: { [SEND]: "auto" } },
    ],
}

/** A side `@2` node on the books. */
const book: ReadinessNode = {
    key: "book",
    step: "accounting.book",
    blocking: false,
    accounts: [{ provider: "google", operations: { [TOOL.ledgerEntryAppend]: "ask" } }],
}

const MAIL = TOOL.mailMessageSend

/** The CRM the installed NIVO Web package is written against, by its provider key, and two of its generated operations. */
const CRM = "crm.nivoweb"
const CUSTOMER_GET = "nivo.api.crm.nivoweb.get.customers.code"
const CUSTOMER_BALANCE = "nivo.api.crm.nivoweb.get.customers.code.balance"

/** A blocking node that reads the CRM and sends a mail (`webbooks.notice-draft`): the CRM reads under the CRM, the mail under SMTP. */
const notice: ReadinessNode = {
    key: "notice",
    step: "webbooks.notice-draft",
    accounts: [
        { provider: CRM, operations: { [CUSTOMER_GET]: "auto", [CUSTOMER_BALANCE]: "auto" } },
        { provider: "smtp", operations: { [MAIL]: "auto" } },
    ],
}

/** A blocking tell node: the send under three messaging providers, the mail under SMTP. */
const tell: ReadinessNode = {
    key: "tell",
    step: "webrenew.tell",
    accounts: [
        { provider: "zalo_oa", operations: { [SEND]: "auto" } },
        { provider: "telegram", operations: { [SEND]: "auto" } },
        { provider: "meta", operations: { [SEND]: "auto" } },
        { provider: "smtp", operations: { [MAIL]: "auto" } },
    ],
}

const shown = (skipped: ReadonlyArray<string> = []): GraphReadiness => ({ hidden: false, skipped })
/** Hidden, waiting for these providers; each `not_connected` unless the reasons are given. */
const hidden = (
    waitingFor: ReadonlyArray<string>,
    reasons: Readonly<Record<string, "not_connected" | "trigger_off" | "needs_pick">> = {},
): GraphReadiness => ({
    hidden: true,
    waitingFor,
    blocked: waitingFor.map((provider) => ({ provider, reason: reasons[provider] ?? "not_connected" })),
})

interface Case {
    readonly name: string
    readonly nodes: ReadonlyArray<ReadinessNode>
    readonly input: ReadinessInput
    readonly expected: GraphReadiness
}

/** The invoice issue (`webbooks.invoice-issue`): the platform purpose `TOOL.invoiceCreate` under the CRM provider (`crm.nivoweb`). */
const issue: ReadinessNode = {
    key: "issue",
    step: "webbooks.invoice-issue",
    accounts: [{ provider: CRM, operations: { [TOOL.invoiceCreate]: "ask" } }],
}

const CASES: ReadonlyArray<Case> = [
    {
        name: "a purpose served only where a pinned document marks it: a bound CRM account whose document does not mark it hides the graph, tool_unavailable",
        nodes: [issue],
        input: {
            attachments: [{ connectionId: "c1", provider: CRM }],
            served: new Map([[TOOL.invoiceCreate, new Set<string>()]]),
        },
        expected: {
            hidden: true,
            waitingFor: [CRM],
            blocked: [{ provider: CRM, reason: "tool_unavailable", tool: TOOL.invoiceCreate }],
        },
    },
    {
        name: "the same purpose once the bound CRM account's pinned document marks it: ready",
        nodes: [issue],
        input: {
            attachments: [{ connectionId: "c1", provider: CRM }],
            served: new Map([[TOOL.invoiceCreate, new Set(["c1"])]]),
        },
        expected: shown(),
    },
    {
        name: "an account that marks the purpose but is not the one bound for the node does not serve it (the default account picks c2)",
        nodes: [issue],
        input: {
            attachments: [
                { connectionId: "c1", provider: CRM },
                { connectionId: "c2", provider: CRM },
            ],
            picked: (provider) => (provider === CRM ? "c2" : null),
            served: new Map([[TOOL.invoiceCreate, new Set(["c1"])]]),
        },
        expected: {
            hidden: true,
            waitingFor: [CRM],
            blocked: [{ provider: CRM, reason: "tool_unavailable", tool: TOOL.invoiceCreate }],
        },
    },
    {
        name: "no CRM account at all: not_connected, as before (the availability is judged only on a bound account)",
        nodes: [issue],
        input: { attachments: [], served: new Map([[TOOL.invoiceCreate, new Set<string>()]]) },
        expected: hidden([CRM]),
    },
    {
        name: "a tool the availability does not name is judged as before: the CRM read on the same account is ready",
        nodes: [{ key: "read", step: "webbooks.notice-draft", accounts: [{ provider: CRM, operations: { [CUSTOMER_GET]: "auto" } }] }],
        input: {
            attachments: [{ connectionId: "c1", provider: CRM }],
            served: new Map([[TOOL.invoiceCreate, new Set<string>()]]),
        },
        expected: shown(),
    },
    {
        name: "a CRM operation no attached snapshot holds hides the graph, `tool_unavailable` naming the operation, the CRM's other operation and SMTP met",
        nodes: [notice],
        input: {
            attachments: [
                { connectionId: "c1", provider: CRM },
                { connectionId: "s1", provider: "smtp" },
            ],
            served: new Map([
                [CUSTOMER_GET, new Set(["c1"])],
                [CUSTOMER_BALANCE, new Set<string>()],
            ]),
        },
        expected: {
            hidden: true,
            waitingFor: [CRM],
            blocked: [{ provider: CRM, reason: "tool_unavailable", tool: CUSTOMER_BALANCE }],
        },
    },
    {
        name: "every CRM operation the node calls held by the bound connection's snapshot: shown",
        nodes: [notice],
        input: {
            attachments: [
                { connectionId: "c1", provider: CRM },
                { connectionId: "s1", provider: "smtp" },
            ],
            served: new Map([
                [CUSTOMER_GET, new Set(["c1"])],
                [CUSTOMER_BALANCE, new Set(["c1"])],
            ]),
        },
        expected: shown(),
    },
    {
        name: "a snapshot of ANOTHER connection holds the operation: the bound one does not serve it, tool_unavailable",
        nodes: [notice],
        input: {
            attachments: [
                { connectionId: "c1", provider: CRM },
                { connectionId: "s1", provider: "smtp" },
            ],
            served: new Map([
                [CUSTOMER_GET, new Set(["c1"])],
                [CUSTOMER_BALANCE, new Set(["c9"])],
            ]),
        },
        expected: {
            hidden: true,
            waitingFor: [CRM],
            blocked: [{ provider: CRM, reason: "tool_unavailable", tool: CUSTOMER_BALANCE }],
        },
    },
    {
        name: "a blocking node with one of its providers attached: shown",
        nodes: [say],
        input: { attachments: [{ connectionId: "t1", provider: "telegram" }] },
        expected: shown(),
    },
    {
        name: "a blocking node with none attached: hidden, waiting for its providers in its order",
        nodes: [say],
        input: { attachments: [{ connectionId: "g1", provider: "google" }] },
        expected: hidden(["zalo_oa", "telegram"]),
    },
    {
        name: "a side node with none attached: shown, the side node skipped",
        nodes: [say, book],
        input: { attachments: [{ connectionId: "z1", provider: "zalo_oa" }] },
        expected: shown(["book"]),
    },
    {
        name: "a hidden graph names only what it waits for, not its skipped side nodes",
        nodes: [say, book],
        input: { attachments: [] },
        expected: hidden(["zalo_oa", "telegram"]),
    },
    {
        name: "@1 node with no accounts member, [] and nivo: ready as today",
        nodes: [
            { key: "old", step: "sales.old" },
            { key: "own", accounts: [] },
            { key: "settle", accounts: [{ provider: "nivo", operations: { [TOOL.agentTag]: "auto" } }] },
            { key: "if", step: "core.if" },
        ],
        input: { attachments: [] },
        expected: shown(),
    },
    {
        name: "@1 kind-wide node: any provider of the kind attached binds it; none hides, naming every provider of the kind",
        nodes: [
            {
                key: "say",
                step: "x",
                accounts: [{ kind: "messaging", provider: null, connectionId: null, operations: { [SEND]: "auto" } }],
            },
        ],
        input: { attachments: [{ connectionId: "m1", provider: "meta" }] },
        expected: shown(),
    },
    {
        name: "@1 kind-wide node with nothing attached: hidden",
        nodes: [
            {
                key: "say",
                step: "x",
                accounts: [{ kind: "messaging", provider: null, connectionId: null, operations: { [SEND]: "auto" } }],
            },
        ],
        input: { attachments: [] },
        expected: hidden(["zalo_oa", "telegram", "meta"]),
    },
    {
        name: "@1 node pinning an account the agent is not attached to: hidden even with another account of the provider",
        nodes: [
            {
                key: "say",
                step: "x",
                accounts: [
                    { kind: "messaging", provider: "zalo_oa", connectionId: "z2", operations: { [SEND]: "auto" } },
                ],
            },
        ],
        input: { attachments: [{ connectionId: "z1", provider: "zalo_oa" }] },
        expected: hidden(["zalo_oa"]),
    },
    {
        name: "a @1 definition that says side (no blocking on the graph node): skipped, not hidden",
        nodes: [
            {
                key: "book",
                step: "accounting.book",
                accounts: [{ provider: "google", operations: { [TOOL.ledgerEntryAppend]: "ask" } }],
            },
        ],
        input: { attachments: [], definedBlocking: (step) => (step === "accounting.book" ? false : undefined) },
        expected: shown(["book"]),
    },
    {
        name: "two accounts of one provider and no pick: never a guess, not bound, hidden (needs_pick)",
        nodes: [{ key: "say", step: "x", accounts: [{ provider: "zalo_oa", operations: { [SEND]: "auto" } }] }],
        input: {
            attachments: [
                { connectionId: "z1", provider: "zalo_oa" },
                { connectionId: "z2", provider: "zalo_oa" },
            ],
        },
        expected: hidden(["zalo_oa"], { zalo_oa: "needs_pick" }),
    },
    {
        name: "two accounts of one provider and the default account is neither of them: not bound, hidden",
        nodes: [{ key: "say", step: "x", accounts: [{ provider: "zalo_oa", operations: { [SEND]: "auto" } }] }],
        input: {
            attachments: [
                { connectionId: "z1", provider: "zalo_oa" },
                { connectionId: "z2", provider: "zalo_oa" },
            ],
            picked: () => "z9",
        },
        expected: hidden(["zalo_oa"], { zalo_oa: "needs_pick" }),
    },
    {
        name: "two accounts and the workspace default account of the kind is one of them: bound",
        nodes: [{ key: "say", step: "x", accounts: [{ provider: "zalo_oa", operations: { [SEND]: "auto" } }] }],
        input: {
            attachments: [
                { connectionId: "z1", provider: "zalo_oa" },
                { connectionId: "z2", provider: "zalo_oa" },
            ],
            picked: (provider) => (provider === "zalo_oa" ? "z2" : null),
        },
        expected: shown(),
    },
    {
        name: "one account of the provider and no pick: bound",
        nodes: [{ key: "say", step: "x", accounts: [{ provider: "zalo_oa", operations: { [SEND]: "auto" } }] }],
        input: { attachments: [{ connectionId: "z1", provider: "zalo_oa" }] },
        expected: shown(),
    },
    {
        name: "per tool: a CRM read and an SMTP send need both; the CRM alone leaves it waiting for SMTP only",
        nodes: [notice],
        input: { attachments: [{ connectionId: "c1", provider: CRM }] },
        expected: hidden(["smtp"]),
    },
    {
        name: "per tool: a CRM read and an SMTP send with both attached: shown",
        nodes: [notice],
        input: {
            attachments: [
                { connectionId: "c1", provider: CRM },
                { connectionId: "s1", provider: "smtp" },
            ],
        },
        expected: shown(),
    },
    {
        name: "per tool: with nothing attached it waits for the providers of both tools",
        nodes: [notice],
        input: { attachments: [] },
        expected: hidden([CRM, "smtp"]),
    },
    {
        name: "per tool: a send under three messaging providers and a mail under SMTP need one messenger AND SMTP",
        nodes: [tell],
        input: { attachments: [{ connectionId: "m1", provider: "meta" }] },
        expected: hidden(["smtp"]),
    },
    {
        name: "per tool: one of three messengers and SMTP bound: shown",
        nodes: [tell],
        input: {
            attachments: [
                { connectionId: "m1", provider: "meta" },
                { connectionId: "s1", provider: "smtp" },
            ],
        },
        expected: shown(),
    },
    {
        name: "per tool: SMTP alone leaves the send waiting for any of its three messengers",
        nodes: [tell],
        input: { attachments: [{ connectionId: "s1", provider: "smtp" }] },
        expected: hidden(["zalo_oa", "telegram", "meta"]),
    },
    {
        name: "per tool: a tool nivo lists is met; the other tool still needs its provider",
        nodes: [
            {
                key: "mixed",
                step: "x.mixed",
                accounts: [
                    { provider: "nivo", operations: { [TOOL.contactGet]: "auto" } },
                    { provider: "smtp", operations: { [MAIL]: "auto" } },
                ],
            },
        ],
        input: { attachments: [] },
        expected: hidden(["smtp"]),
    },
    {
        name: "per tool: a side node waiting for one of its tools is skipped",
        nodes: [say, { ...notice, blocking: false }],
        input: {
            attachments: [
                { connectionId: "z1", provider: "zalo_oa" },
                { connectionId: "c1", provider: CRM },
            ],
        },
        expected: shown(["notice"]),
    },
    {
        name: "the trigger hook (later slice) hides the same way",
        nodes: [say],
        input: { attachments: [{ connectionId: "z1", provider: "zalo_oa" }], triggers: { waitingFor: ["sepay"] } },
        expected: hidden(["sepay"]),
    },
    {
        name: "the trigger side's reasons are kept: an account whose switch is off is trigger_off",
        nodes: [say],
        input: {
            attachments: [
                { connectionId: "z1", provider: "zalo_oa" },
                { connectionId: "s1", provider: "sepay" },
            ],
            triggers: { waitingFor: ["sepay"], blocked: [{ provider: "sepay", reason: "trigger_off" }] },
        },
        expected: hidden(["sepay"], { sepay: "trigger_off" }),
    },
]

describe("graphReadinessOf", () => {
    it.each(CASES.map((one) => [one.name, one] as const))("%s", async (_name, one) => {
        const { readinessOf } = await build()
        expect(readinessOf({ nodes: one.nodes }, one.input)).toEqual(one.expected)
    })
})

describe("sideNodeWaitingOf", () => {
    it("names the providers of an unbound side node, and nothing for a blocking or bound one", async () => {
        const { sideOf } = await build()
        expect(sideOf(book, { attachments: [] })).toEqual(["google"])
        expect(sideOf(book, { attachments: [{ connectionId: "g1", provider: "google" }] })).toBeNull()
        expect(sideOf(say, { attachments: [] })).toBeNull()
        expect(sideOf({ key: "old", blocking: false }, { attachments: [] })).toBeNull()
    })
})

/** The agents whose behaviour must not change: the three core agents, then the five agents the NIVO Web plugin wires. */
const MODULES = ["sales", "chatbot", "accounting", "webmail", "webdocs", "webrenew", "webdesk", "webbooks"]

const definedBlocking = new Map<string, boolean | undefined>(
    INSTALLED.nodeInstall().nodes.map((node) => [node.id, node.blocking]),
)

/**
 * The accounts a fresh agent of a module is attached to (nivo-frame `rights`: an attachment is agent + connection, no ticks), one working
 * account of each provider its template agent lists, AS NODES NAME THEM: an OpenAPI account is attached when it is pinned to a source the
 * agent lists (`OPENAPI_SOURCE_KEYS`), and nodes name it by that source. A module with no template agent attaches nothing.
 */
const attachedAsDefaultsOf = (moduleKey: string): ReadinessInput["attachments"] => {
    const agent = INSTALLED.templateAgentOf(moduleKey)
    if (agent === null) return []
    const named: ReadonlyArray<string> = agent.accounts
    return PROVIDER_CATALOGUE.filter(
        (spec) => spec.provider === OPENAPI_PROVIDER || named.includes(spec.provider),
    ).flatMap((spec) =>
        spec.provider === OPENAPI_PROVIDER
            ? agent.accounts
                  .filter((listed) => OPENAPI_SOURCE_KEYS.includes(listed))
                  .map((source) => ({ connectionId: `${OPENAPI_PROVIDER}-${source}-1`, provider: source }))
            : [{ connectionId: `${spec.provider}-1`, provider: spec.provider }],
    )
}

describe("readiness hides no graph that runs today", () => {
    it("every latest core and NIVO Web template is ready, nothing skipped, for an agent attached as attachDefaults attaches it", async () => {
        const { readinessOf } = await build()
        const templates = MODULES.flatMap((moduleKey) =>
            INSTALLED.templatesOf(moduleKey).map((template) => {
                // attachDefaults with no wishes, as nodes name the accounts (`attachedAsDefaultsOf`).
                const attachments = attachedAsDefaultsOf(moduleKey)
                const graph = latestTemplateVersion(template).graph
                const input: ReadinessInput = { attachments, definedBlocking: (step) => definedBlocking.get(step) }
                return [template.id, readinessOf(graph, input)] as const
            }),
        )
        expect(templates.length).toBeGreaterThan(0)
        expect(templates.filter(([, readiness]) => readiness.hidden || readiness.skipped.length > 0)).toEqual([])
    })

    it("an agent with no account at all hides exactly the templates one of whose blocking nodes declares accounts", async () => {
        const { readinessOf } = await build()
        let hiddenCount = 0
        for (const moduleKey of MODULES) {
            for (const template of INSTALLED.templatesOf(moduleKey)) {
                const graph = latestTemplateVersion(template).graph
                const readiness = readinessOf(graph, {
                    attachments: [],
                    definedBlocking: (step) => definedBlocking.get(step),
                })
                // A node "declares" an account when one of its providers (as the binding reads its entries, `nodeProvidersOf`) is not
                // NIVO's own: `nivo` is always bound and hides nothing; a source key (`crm`) is an account like any other.
                const blockingDeclares = graph.nodes.some(
                    (node) =>
                        nodeProvidersOf(node).some((wanted) => wanted.provider !== NIVO_PROVIDER) &&
                        (node.blocking ?? definedBlocking.get(node.step)) !== false,
                )
                expect([template.id, readiness.hidden]).toEqual([template.id, blockingDeclares])
                if (readiness.hidden) hiddenCount += 1
            }
        }
        // Not vacuous: some template does wait for a provider.
        expect(hiddenCount).toBeGreaterThan(0)
    })
})
