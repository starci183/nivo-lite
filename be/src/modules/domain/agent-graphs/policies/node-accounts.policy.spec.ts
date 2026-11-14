import { Test } from "@nestjs/testing"
import type { GraphSpec, GraphV2Step } from "@nivo-lite/agent-sdk/graph"
import { latestTemplateVersion, type TemplateAgent, type TemplateGraph } from "@nivo-lite/agent-sdk/template"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { accountKindOf } from "@modules/domain/installed-plugins/template-graph-adapter.policy"
import { templateGraph } from "@tests/fixtures/builders/agent-workflows.builder"
import { templateFlowProblems } from "./flow.policy"
import recorded from "./node-accounts-table.json"
import { nodeAccountLookup, nodeProvidersOf } from "./node-accounts.policy"

/**
 * The proof of the node rights of every installed template agent (the core agents and the NIVO Web plugin's), read from
 * the installation the engine runs by (`INSTALLED.templateAgents()`, GraphSpec `@2`). nivo-frame `rights`: a node declares ONE mode and
 * its providers in priority order; nothing is bound at install (no row): the runner binds per provider at RUN TIME. The table records,
 * for every template graph x node step, the graph, the step key, the node id, the step's mode and its providers in order
 * (`node-accounts-table.json`, RE-RECORDED in this shape when the install-time rows were removed). A change of a node's mode or of a
 * provider list or order fails here until it is re-recorded on purpose; `agent-graph-rights.install-rows.spec.ts` proves the run-time
 * reader and binding answer exactly this table.
 *
 * Ledger (TOOLS-LEAD, 2026-11-13): the table was RE-RECORDED from the installation (191 -> 225 rows), after the diff was read row by row:
 * (a) owner "NIVO Web auto gan het" (BIZ-MOVE D-5): 24 nivo-web-core steps moved `ask` -> `auto` (every step of webdesk, webrenew, websales,
 *     webbooks except `webbooks.invoice#issue`, which stays `ask`; the 25th, `sales.consult#cancel-order`, is (c));
 * (b) ten new graphs: booking.book / .remind / .team-chat, content.plan / .draft / .report, hiring.screen / .digest, video.produce,
 *     sales.payment (34 rows);
 * (c) `sales.consult` recomposed by ACCOUNT-DATA (cancel-order is `auto`; `order-record` -> `order-create`; confirm / win / payment-request /
 *     send-qr / schedule / notify steps replaced by tell-order, arm-reminder, cancel-read, cancel-paid-notice) and its sibling
 *     `sales.payment-reminder` (node renamed `payment-remind`, `read` added, `tell-team` removed);
 * (d) NOT in the first three reasons, named elsewhere: the accounting agent is dropped, so `accounting.team-chat` (3 rows) is gone;
 * (e) NOT in the first three reasons: the money lane's `webbooks.payment` now has `credit` (sepay, casso) and `open` (crm) steps and its
 *     `match` step lists `crm` only (it reads the credit from the step before; `payment-settle.node.ts` declares `accounts: [CRM_PROVIDER]`).
 * Rows under (d) and (e) are flagged to the lead for a word; no row is unexplained.
 * Ledger (ACCOUNT-DATA 4M-12, 2026-11-13, re-recorded 225 -> 225 rows, read row by row): (f) `sales.consult` gains `request-qr`
 * (`sales.request-qr`, auto, [sepay]: the transfer QR) and `cancel-reminder`, `sales.after-sale` gains `cancel-reminder`
 * (`sales.payment-reminder-cancel`, auto, none); `sales.payment#credit` lists [sepay, casso, payos] (one credit read for the three
 * feeds); (g) NOT ours: `booking.team-chat` (3 rows) is no longer installed (BIZ-MOVE's booking agent), flagged to its lead.
 * Ledger (TOOLS-LEAD F2, 2026-11-13, 226 rows): (h) `sales.web-order` gains its start step `lead` (`sales.web-order-lead`, auto, none: finds or makes
 * the sale's lead of the website contact; ACCOUNT-DATA-LEAD's addendum 1, graph v5 -> v6).
 * Ledger (ENGINE-FIX EF-G, 2026-11-14, re-recorded 232 -> 258 rows, read row by row): (i) rights rule 11e (one write per `ask` step):
 * `booking.book#confirm` (`booking.confirm`, ask) keeps ONE write (the record) and so lists no provider; the customer send and the team
 * post moved to `tell` (`booking.confirm-tell`, auto, [zalo_oa, telegram, meta]) and `notify` (`booking.confirm-notify`, auto, none);
 * `hiring.screen` gains `move` (`hiring.invite-move`, auto, none: the record move split off the `ask` mail of `invite`); (j) rights rule
 * 11c (a declined write is a business outcome): 23 `team.declined-notice` steps (auto, none) on the declined routes of booking.book,
 * content.plan / .draft, hiring.screen, video.produce, sales.consult / .payment / .web-order; (k) NOT ours: `chatbot.front-desk#hear`
 * (`chatbot.hear`, auto, none) is a step another lead added; recorded as installed, flagged to the ENGINE-FIX lead.
 * Ledger (ROAD Opus-1f, 2026-11-14, coordinator R44, re-recorded 258 -> 261 rows from the installation, read by diff): (j) `sales.consult`
 * v25 (Opus-3f 06:17): + `not-sale-notice` (`sales.not-sale-notice`, auto, none), + `paid-declined-notice` (`team.declined-notice`), and the
 * payment wait folded into the sale (+ `credit` [sepay, casso, payos], `paid-order`, `short`, `short-notice`, `order-talk`, `remind`
 * [zalo_oa, telegram, meta]); - `arm-reminder` / `cancel-reminder` (the reminder nodes are deleted, R28), - the graph
 * `sales.payment-reminder` (`read`, `remind`) and `sales.after-sale#cancel-reminder`. (k) every NIVO Web agent's CRM provider is the pinned
 * OpenAPI source `crm.nivoweb` (was `crm`): providers by id, as the CRM ruling names them; modes unchanged.
 * Ledger (ROAD Opus-1g, 2026-11-14, coordinator R45, re-recorded 261 -> 262 rows from the installation of the 06:43 build, read by diff):
 * `sales.consult` v27 + `keep-occasions-declined-notice` (`team.declined-notice`, auto, none): a declined dates keep tells the team.
 * Ledger (ROAD Opus-1h, 2026-11-14, coordinator R45 packages half, re-recorded 262 -> 265 rows from the installation of the 07:08 build,
 * read by diff): `sales.consult` v28 + `order-talk-unsent-notice` (NEW generic `team.unsent-notice`, auto, none: a refused/declined order
 * answer tells the team) and + `unpaid-notice` (`sales.unpaid-notice`, auto, none: the pay loop ran out); `sales.after-sale` v15 +
 * `thank-unsent-notice` (`team.unsent-notice`, auto, none). `not-sale-notice` keeps its row (its step key is unchanged inside `talk`).
 * Ledger (P1, 2026-11-14, coordinator R47, 265 -> 266 rows, read by diff): `sales.consult` v29 + `remind-unsent-notice` (`team.unsent-notice`, auto, none:
 * a refused payment reminder tells the team); `remind-sent` is an if-step and has no row.
 * Ledger (RESTART-R4, 2026-11-14, coordinator R53, 266 -> 270 rows from the installation of WEBCORE's 11:51 build, read by diff): the
 * one-run talks `websales.enquiry` v8 and `webrenew.answer` v14 + `desk` (`webdesk.understand-sales`, auto, none) and + `message`
 * (`websales.round-message` / `webrenew.round-message`, auto, none) each; the other rows of the two graphs keep graph/step/node/mode/
 * providers (only `webrenew.answer`'s `reply`, `reply-notice`, `unlinked-tell` move up in the order).
 */

/** A node step of a template graph. */
type NodeStep = Extract<GraphV2Step, { readonly kind: "node" }>

/** One line of the recorded table. */
interface Line {
    readonly graph: string
    readonly step: string
    readonly node: string
    readonly mode: string
    readonly providers: ReadonlyArray<string>
}

/** One graph of a template agent, with its node steps and the engine's graph (`@1`, the adapter's output) a workflow version stores. */
interface Case {
    readonly agent: TemplateAgent
    readonly graph: TemplateGraph
    readonly steps: ReadonlyArray<NodeStep>
    readonly engineGraph: GraphSpec
}

/** Every graph of every template agent the installation ships. */
const CASES: ReadonlyArray<Case> = INSTALLED.templateAgents().flatMap((agent) =>
    agent.graphs.map((graph): Case => ({
        agent,
        graph,
        steps: graph.spec.nodes.flatMap((step) => (step.kind === "node" ? [step] : [])),
        engineGraph: templateGraph(graph.key),
    })),
)

/** The table as the installation declares it. */
const declaredLines = (): ReadonlyArray<Line> =>
    CASES.flatMap((one) =>
        one.steps.map((step): Line => ({
            graph: one.graph.key,
            step: step.key,
            node: step.step,
            mode: step.mode,
            providers: [...step.accounts],
        })),
    )

const SUBJECT = Symbol("node-accounts.policy")

/** The policy members under test, read through the Nest testing module. */
const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { lookup: nodeAccountLookup, providers: nodeProvidersOf } }],
    }).compile()
    return moduleRef.get<{ readonly lookup: typeof nodeAccountLookup; readonly providers: typeof nodeProvidersOf }>(
        SUBJECT,
    )
}

describe("the node rights of every installed template agent: each step's ONE mode and its providers in order, recorded", () => {
    // Ledger (TOOLS-LEAD 2026-11-13): "accounting" leaves the list (the agent is dropped); booking, content, hiring and video join it.
    it("covers the core agents and the six NIVO Web agents, and some step lists providers", () => {
        const agents = [...new Set(CASES.map((one) => one.agent.key))]
        expect(agents).toEqual(
            expect.arrayContaining([
                "chatbot",
                "sales",
                "booking",
                "content",
                "hiring",
                "video",
                "webmail",
                "webdocs",
                "webdesk",
                "webrenew",
                "webbooks",
                "websales",
            ]),
        )
        expect(agents).not.toContain("accounting")
        expect(CASES.every((one) => one.steps.length > 0)).toBe(true)
        expect(CASES.some((one) => one.steps.some((step) => step.accounts.length > 0))).toBe(true)
        expect(CASES.some((one) => one.steps.some((step) => step.mode === "ask"))).toBe(true)
    })

    it("holds the recorded table: a node's mode, a provider or an order changes only on purpose", () => {
        expect(declaredLines()).toEqual(recorded.lines)
    })

    // Ledger (TOOLS-LEAD 2026-11-13; templates.md: `tools` lists only tools that act outside, the record / brain / contact tools are every node's
    // by default; the adapter's `accountsOfStep` is a pure copy of the step's providers and `mode` is carried on every node step): the old
    // expectation added a pseudo-account `nivo` carrying every listed tool at the step's mode. Both are gone; the step's providers and its
    // ONE mode are what the engine's node carries.
    it("is carried by the adapter as the `@1` node's accounts: the step's providers in order, no operations, and the step's ONE mode", () => {
        for (const one of CASES) {
            for (const step of one.steps) {
                const node = one.engineGraph.nodes.find((candidate) => candidate.key === step.key)
                expect([one.graph.key, step.key, node?.step, node?.mode, node?.accounts]).toEqual([
                    one.graph.key,
                    step.key,
                    step.step,
                    step.mode,
                    step.accounts.map((provider) => ({ kind: accountKindOf(provider), provider, connectionId: null })),
                ])
            }
        }
    })

    it("passes the engine's save check of its accounts", () => {
        for (const template of INSTALLED.templates().filter((entry) => INSTALLED.templateGraphOf(entry.id) !== null)) {
            const problems = templateFlowProblems(latestTemplateVersion(template).graph) ?? []
            expect([template.id, problems.filter((problem) => problem.code.startsWith("NODE_ACCOUNT_"))]).toEqual([
                template.id,
                [],
            ])
        }
    })
})

describe("nodeAccountLookup", () => {
    it("knows the kinds of the provider catalogue and a provider only under its own kind", async () => {
        const { lookup } = await build()
        expect(lookup.knows("messaging", null)).toBe(true)
        expect(lookup.knows("payment", "sepay")).toBe(true)
        expect(lookup.knows("messaging", "sepay")).toBe(false)
        expect(lookup.knows("fax", null)).toBe(false)
    })
})
