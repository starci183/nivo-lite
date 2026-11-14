import type { GraphV2Step } from "@nivo-lite/agent-sdk/graph"
import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateGraph,
    type TemplateTriggerLookup,
    templateAgentProblems,
    templateGraphProblems,
} from "@nivo-lite/agent-sdk/template"
import { CRM_NIVOWEB_PROVIDER } from "../../../crm/nivoweb/api.generated"
import { webbooksText } from "../copy"
import { WEBBOOKS_PROVIDERS } from "../webbooks.accounts"
import { debtRoundGraph } from "./debt-round.graph"
import { invoiceGraph } from "./invoice.graph"
import { paymentGraph } from "./payment.graph"
import { supplierInvoicesGraph } from "./supplier-invoices.graph"
import { teamChatGraph } from "./team-chat.graph"
import { webbooksAgent } from "./webbooks.agent"

/**
 * The engine's trigger lookup as this spec assumes it (ruling B5; the one event pipeline 2026-11-14): a credit supplies the generic members of
 * an account event (its id inside `data`), the clock its preset, a call what it maps.
 */
const triggers: TemplateTriggerLookup = {
    supplies: (verb) => {
        if (verb === TRIGGER.workflowCalled) return { kind: "caller" }
        if (verb === TRIGGER.paymentCreditReceived) {
            return {
                kind: "fixed",
                params: [
                    { name: "eventId", type: "string" },
                    { name: "accountId", type: "string" },
                    { name: "data", type: "object" },
                ],
            }
        }
        if (verb === TRIGGER.clockTick) return { kind: "fixed", params: [{ name: "preset", type: "string" }] }
        return { kind: "unknown" }
    },
}

/** The shared notice of a declined approval (blocks-core `team.declined-notice`). */
const NOTICE = "team.declined-notice"

/** A graph's steps by key, each with its kind and, for a node step, its node id; a body step names its loop. */
const stepsOf = (graph: TemplateGraph): ReadonlyArray<readonly [string, string]> =>
    graph.spec.nodes.map(
        (step) =>
            [
                step.loop === undefined ? step.key : `${step.loop}/${step.key}`,
                step.kind === "node" ? step.step : step.kind,
            ] as const,
    )

/** A graph's compiled step by key (a body step by its own key), or a failed expectation. */
const stepOf = (graph: TemplateGraph, key: string): GraphV2Step => {
    const step = graph.spec.nodes.find((one) => one.key === key)
    if (step === undefined) throw new Error(`no step ${key} in ${graph.key}`)
    return step
}

/** What a blocking ask step's declined wiring names: the check, the notice (with the step's title) and the end. */
interface DeclinedWiring {
    readonly step: string
    readonly check: string
    readonly notice: string
    /** The `declined` outcome's key, or null: inside a loop body the item ends after the notice. */
    readonly end: string | null
    /** The plain (vi) title of the declined step, bound into the notice. */
    readonly title: string
    /** The notice's scope: `item` inside a loop body (only the item is skipped), absent (the default `run`) outside one. */
    readonly scope: "run" | "item"
}

/**
 * The declined wiring of a blocking ask step, as compiled data: the step goes to an `if` that holds exactly when its `declined` is
 * true, whose yes is the shared notice (`team.declined-notice`, the step's title bound), which goes on to the `declined` outcome or,
 * in a loop body, nowhere (the item ends).
 */
const expectDeclinedWiring = (graph: TemplateGraph, wiring: DeclinedWiring): void => {
    const step = stepOf(graph, wiring.step)
    expect(step.kind === "node" ? step.next : undefined).toBe(wiring.check)
    const check = stepOf(graph, wiring.check)
    if (check.kind !== "if") throw new Error(`${wiring.check} is no if`)
    expect(check.params.when).toEqual({
        op: "eq",
        ref: expect.objectContaining({ $ref: `steps.${wiring.step}.output.declined` }),
        value: true,
    })
    expect(check.routes.yes).toBe(wiring.notice)
    const notice = stepOf(graph, wiring.notice)
    if (notice.kind !== "node") throw new Error(`${wiring.notice} is no node step`)
    expect(notice.step).toBe(NOTICE)
    expect(notice.params["step"]).toEqual(wiring.title)
    if (wiring.scope === "item") expect(notice.params["scope"]).toEqual("item")
    else expect(notice.params["scope"] ?? "run").toEqual("run")
    expect(notice.next ?? null).toBe(wiring.end)
    if (wiring.end === null) return
    const end = stepOf(graph, wiring.end)
    if (end.kind !== "outcome") throw new Error(`${wiring.end} is no outcome`)
    expect(end.params.outcome).toBe("declined")
}

/**
 * The declined wiring of a team post (the declined write is itself a team post: no notice): the step goes to an `if` that holds exactly
 * when its `declined` is true, whose `yes` route is `yes` (the `declined` outcome, or null inside a loop body: the item ends) and whose
 * `no` route is `no`.
 */
const expectTeamDeclined = (
    graph: TemplateGraph,
    wiring: { readonly step: string; readonly check: string; readonly yes: string | null; readonly no: string },
): void => {
    const step = stepOf(graph, wiring.step)
    expect(step.kind === "node" ? step.next : undefined).toBe(wiring.check)
    const check = stepOf(graph, wiring.check)
    if (check.kind !== "if") throw new Error(`${wiring.check} is no if`)
    expect(check.params.when).toEqual({
        op: "eq",
        ref: expect.objectContaining({ $ref: `steps.${wiring.step}.output.declined` }),
        value: true,
    })
    // `endItem` compiles to the route left out: the item ends.
    expect(check.routes.yes).toBe(wiring.yes ?? undefined)
    expect(check.routes.no).toBe(wiring.no)
    if (wiring.yes !== null) {
        const end = stepOf(graph, wiring.yes)
        if (end.kind !== "outcome") throw new Error(`${wiring.yes} is no outcome`)
        expect(end.params.outcome).toBe("declined")
    }
}

describe("the Accounting agent template (webbooks)", () => {
    it("loads with no problem, its graphs judged with its providers, the triggers' supplies and strict nullability", () => {
        expect(templateAgentProblems(webbooksAgent, { triggers })).toEqual([])
        for (const graph of webbooksAgent.graphs) {
            expect(
                templateGraphProblems(graph.spec, {
                    nodes: graph.nodes,
                    agentAccounts: webbooksAgent.accounts,
                    triggers,
                    nullability: "strict",
                }),
            ).toEqual([])
        }
    })

    it("works with the CRM, the bank feeds and the sending mailbox; the invoice is primary", () => {
        expect(webbooksAgent.key).toBe("webbooks")
        expect(webbooksAgent.accounts).toEqual(WEBBOOKS_PROVIDERS)
        expect(WEBBOOKS_PROVIDERS).toEqual([CRM_NIVOWEB_PROVIDER, PROVIDER.sepay, PROVIDER.casso, PROVIDER.smtp])
        expect(webbooksAgent.graphs.map((graph) => graph.key)).toEqual([
            "webbooks.invoice",
            "webbooks.payment",
            "webbooks.debt-round",
            "webbooks.supplier-invoices",
            "webbooks.team-chat",
        ])
        expect(webbooksAgent.primary).toBe(invoiceGraph.key)
    })
})

describe("webbooks.invoice", () => {
    it("is version 9, reached by a call, open to any caller", () => {
        // ledger 2026-11-13 (`nivo-frame.rights`): every graph's catalogue version + 1 (one mode per node changed every compiled document).
        expect(invoiceGraph.spec.catalogue?.version).toBe(9)
        expect(invoiceGraph.key).toBe("webbooks.invoice")
        expect(invoiceGraph.spec.triggers).toEqual([{ verb: TRIGGER.workflowCalled }])
        expect(invoiceGraph.spec.entry.openTo).toBe("any")
    })

    it("drafts, issues, mails a real invoice only, tells the team on both paths", () => {
        expect(stepsOf(invoiceGraph)).toEqual([
            ["draft", "webbooks.invoice-draft"],
            ["draft-declined", "if"],
            ["draft-notice", NOTICE],
            ["issue", "webbooks.invoice-issue"],
            ["issue-declined", "if"],
            ["issue-notice", NOTICE],
            ["issued", "if"],
            ["mail", "webbooks.invoice-mail"],
            ["team", "webbooks.invoice-team"],
            ["team-declined", "if"],
            ["invoiced", "outcome"],
            ["declined", "outcome"],
        ])
    })

    it("a declined draft or a declined issue tells the team and ends declined; nothing after it runs", () => {
        expectDeclinedWiring(invoiceGraph, {
            step: "draft",
            check: "draft-declined",
            notice: "draft-notice",
            end: "declined",
            scope: "run",
            title: webbooksText("node.invoice-draft.title").vi,
        })
        expect(stepOf(invoiceGraph, "draft-declined")).toMatchObject({ routes: { no: "issue" } })
        expectDeclinedWiring(invoiceGraph, {
            step: "issue",
            check: "issue-declined",
            notice: "issue-notice",
            end: "declined",
            scope: "run",
            title: webbooksText("node.invoice-issue.title").vi,
        })
        expect(stepOf(invoiceGraph, "issue-declined")).toMatchObject({ routes: { no: "issued" } })
    })

    it("a declined team post ends declined with no notice (the declined write is itself a team post)", () => {
        expectTeamDeclined(invoiceGraph, { step: "team", check: "team-declined", yes: "declined", no: "invoiced" })
    })
})

describe("webbooks.payment", () => {
    it("is version 11, woken by a bank credit on SePay or Casso, open to any caller", () => {
        // 2026-11-14: version 11 reads the credit's row id from the event's data (`trigger.data.transactionId`, the one event pipeline).
        expect(paymentGraph.spec.catalogue?.version).toBe(11)
        expect(paymentGraph.key).toBe("webbooks.payment")
        // Ledger (owner key triggerOneSource2026_11_12, CORRECTED 2026-11-12: one source per STREAM): the trigger lists its providers
        // again (`accounts`); Casso, cut by the single-account shape, is restored (two bank accounts = two sources, one = the founder's pick).
        expect(paymentGraph.spec.triggers).toEqual([
            { verb: TRIGGER.paymentCreditReceived, accounts: [PROVIDER.sepay, PROVIDER.casso] },
        ])
        expect(paymentGraph.spec.entry.openTo).toBe("any")
    })

    it("reads the credit and the open requests, settles, then records, tells and hands on per kind of request", () => {
        expect(stepsOf(paymentGraph)).toEqual(
            expect.arrayContaining([
                ["credit", "webbooks.payment-credit"],
                ["open", "webbooks.payment-open"],
                ["match", "webbooks.payment-settle"],
                ["record", "webbooks.renewal-paid"],
                ["record-team", "webbooks.renewal-paid-team"],
                ["to-renew", "call-workflow"],
                ["paid", "outcome"],
                ["purchase", "webbooks.purchase-paid"],
                ["purchase-team", "webbooks.purchase-paid-team"],
                ["to-sales", "call-workflow"],
                ["purchase-paid", "outcome"],
                ["record-declined", "if"],
                ["record-notice", NOTICE],
                ["purchase-declined", "if"],
                ["purchase-notice", NOTICE],
                ["declined", "outcome"],
            ]),
        )
        expect(paymentGraph.spec.nodes).toHaveLength(16)
        expect(paymentGraph.spec.nodes[0].key).toBe("credit")
    })

    it("a declined record of money tells the team and ends declined: no team line, no hand-off", () => {
        expectDeclinedWiring(paymentGraph, {
            step: "record",
            check: "record-declined",
            notice: "record-notice",
            end: "declined",
            scope: "run",
            title: webbooksText("node.renewal-paid.title").vi,
        })
        expect(stepOf(paymentGraph, "record-declined")).toMatchObject({ routes: { no: "record-team" } })
        expectDeclinedWiring(paymentGraph, {
            step: "purchase",
            check: "purchase-declined",
            notice: "purchase-notice",
            end: "declined",
            scope: "run",
            title: webbooksText("node.purchase-paid.title").vi,
        })
        expect(stepOf(paymentGraph, "purchase-declined")).toMatchObject({ routes: { no: "purchase-team" } })
    })

    it("a declined team line is a side line: it skips that line only and the hand-off runs (the money is recorded)", () => {
        expect(stepOf(paymentGraph, "record-team")).toMatchObject({ next: "to-renew" })
        expect(stepOf(paymentGraph, "purchase-team")).toMatchObject({ next: "to-sales" })
        expect(paymentGraph.spec.nodes.some((step) => step.key === "record-team-declined")).toBe(false)
        expect(paymentGraph.spec.nodes.some((step) => step.key === "purchase-team-declined")).toBe(false)
    })
})

describe("webbooks.debt-round", () => {
    it("is version 7, woken by the weekday 09:00 clock, open to the agent only", () => {
        // ledger 2026-11-13 (`nivo-frame.rights`): every graph's catalogue version + 1 (one mode per node changed every compiled document).
        expect(debtRoundGraph.spec.catalogue?.version).toBe(7)
        expect(debtRoundGraph.key).toBe("webbooks.debt-round")
        expect(debtRoundGraph.spec.triggers).toEqual([
            { verb: TRIGGER.clockTick, args: { preset: "weekdays_at", at: "09:00" } },
        ])
        expect(debtRoundGraph.spec.entry.openTo).toBe("agent")
    })

    it("loops the due receivables through team, draft, drafted? and record, then reports", () => {
        expect(stepsOf(debtRoundGraph)).toEqual(
            expect.arrayContaining([
                ["due", "webbooks.due"],
                ["work", "if"],
                ["each", "loop"],
                ["each/team", "webbooks.notice-team"],
                ["each/draft", "webbooks.notice-draft"],
                ["each/drafted", "if"],
                ["each/record", "webbooks.notice-record"],
                ["each/record-declined", "if"],
                ["each/record-notice", NOTICE],
                ["report", "webbooks.round-report"],
                ["report-declined", "if"],
                ["reminded", "outcome"],
                ["nothing-due", "outcome"],
                ["declined", "outcome"],
            ]),
        )
        expect(debtRoundGraph.spec.nodes).toHaveLength(14)
    })

    it("a declined record tells the team and ends its item only; the round goes on to the report", () => {
        expectDeclinedWiring(debtRoundGraph, {
            step: "record",
            check: "record-declined",
            notice: "record-notice",
            end: null,
            scope: "item",
            title: webbooksText("node.notice-record.title").vi,
        })
        expect(stepOf(debtRoundGraph, "record-declined")).toMatchObject({ loop: "each", routes: {} })
        expect(stepOf(debtRoundGraph, "record-declined")).not.toHaveProperty("routes.no")
        expect(stepOf(debtRoundGraph, "each")).toMatchObject({ params: { collect: "record" }, next: "report" })
    })

    it("a declined team line of a receivable is a side line (the customer notice goes on); a declined round report ends declined", () => {
        expect(stepOf(debtRoundGraph, "team")).toMatchObject({ loop: "each", next: "draft" })
        expect(debtRoundGraph.spec.nodes.some((step) => step.key === "team-declined")).toBe(false)
        expectTeamDeclined(debtRoundGraph, {
            step: "report",
            check: "report-declined",
            yes: "declined",
            no: "reminded",
        })
    })
})

describe("webbooks.supplier-invoices", () => {
    it("is version 7, reached by a call, open to any caller", () => {
        // ledger 2026-11-13 (`nivo-frame.rights`): every graph's catalogue version + 1 (one mode per node changed every compiled document).
        expect(supplierInvoicesGraph.spec.catalogue?.version).toBe(7)
        expect(supplierInvoicesGraph.key).toBe("webbooks.supplier-invoices")
        expect(supplierInvoicesGraph.spec.triggers).toEqual([{ verb: TRIGGER.workflowCalled }])
        expect(supplierInvoicesGraph.spec.entry.openTo).toBe("any")
    })

    it("loops the handed mails through check and note (a matched one noted), then reports", () => {
        expect(stepsOf(supplierInvoicesGraph)).toEqual(
            expect.arrayContaining([
                ["any-mail", "if"],
                ["each", "loop"],
                ["each/check", "webbooks.supplier-check"],
                ["each/note", "webbooks.supplier-note"],
                ["each/note-declined", "if"],
                ["each/note-notice", NOTICE],
                ["report", "webbooks.supplier-report"],
                ["report-declined", "if"],
                ["checked", "outcome"],
                ["declined", "outcome"],
            ]),
        )
        expect(supplierInvoicesGraph.spec.nodes).toHaveLength(10)
    })

    it("a declined note tells the team and ends its item only; the report reads every item from the note", () => {
        expectDeclinedWiring(supplierInvoicesGraph, {
            step: "note",
            check: "note-declined",
            notice: "note-notice",
            end: null,
            scope: "item",
            title: webbooksText("node.supplier-note.title").vi,
        })
        expect(stepOf(supplierInvoicesGraph, "note-declined")).not.toHaveProperty("routes.no")
        expect(stepOf(supplierInvoicesGraph, "each")).toMatchObject({ params: { collect: "note" }, next: "report" })
    })

    it("a declined report ends declined with no notice (the declined write is itself a team post)", () => {
        expectTeamDeclined(supplierInvoicesGraph, {
            step: "report",
            check: "report-declined",
            yes: "declined",
            no: "checked",
        })
    })
})

describe("webbooks.team-chat", () => {
    it("is the factory's chat-turn graph under the module's key, reached by a call", () => {
        expect(teamChatGraph.key).toBe("webbooks.team-chat")
        expect(teamChatGraph.spec.triggers).toEqual([{ verb: TRIGGER.workflowCalled }])
        // ledger 2026-11-13 (`nivo-frame.rights`): every graph's catalogue version + 1 (one mode per node changed every compiled document).
        // 2026-11-14 (`rights` 11c): a declined answer post ends the turn `declined`.
        expect(teamChatGraph.spec.catalogue?.version).toBe(6)
    })

    it("answers with the module's own turn, proposes only when it wrote a proposal, then posts; a declined post ends declined", () => {
        expect(stepsOf(teamChatGraph)).toEqual([
            ["answer", "webbooks.team-answer"],
            ["has-proposal", "if"],
            ["propose", "team.truth-propose"],
            ["post", "team.answer-post"],
            ["post-declined", "if"],
            ["declined", "outcome"],
        ])
        expect(stepOf(teamChatGraph, "post")).toMatchObject({ next: "post-declined" })
        expect(stepOf(teamChatGraph, "post-declined")).toMatchObject({ routes: { yes: "declined" } })
        expect(stepOf(teamChatGraph, "post-declined")).not.toHaveProperty("routes.no")
    })
})

describe("the webbooks catalogues' seedActive", () => {
    it("mirrors the old JSON template of every graph: active at seed exactly where the JSON said `seedActive: true`", () => {
        const seeded = webbooksAgent.graphs.map(
            (graph) => [graph.key, graph.spec.catalogue?.seedActive === true] as const,
        )
        expect([...seeded].sort(([a], [b]) => a.localeCompare(b))).toEqual([
            ["webbooks.debt-round", false],
            ["webbooks.invoice", false],
            ["webbooks.payment", false],
            ["webbooks.supplier-invoices", false],
            ["webbooks.team-chat", true],
        ])
    })
})
