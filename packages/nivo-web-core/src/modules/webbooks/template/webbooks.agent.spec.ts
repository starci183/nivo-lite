import type { GraphV2Step } from "@nivo-lite/agent-sdk/graph"
import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateGraph,
    type TemplateTriggerLookup,
    templateAgentProblems,
    templateGraphProblems,
} from "@nivo-lite/agent-sdk/template"
import { CRM_NIVOWEB_PROVIDER } from "../../../crm/nivoweb/api.generated"
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

/** What a blocking ask step's unsuccessful ending declares (R68): its exit, the policy, the outcome and the notice's facts. */
interface UnsuccessfulWiring {
    readonly step: string
    /** The step's own exit (null: the item ends there, inside a loop body). */
    readonly next: string | null
    readonly then: "continue" | "end"
    /** With `end`: the `declined` outcome's key. */
    readonly outcome?: string
    /** The facts: label (vi) and the ref read. */
    readonly facts: ReadonlyArray<readonly [string, string]>
}

/**
 * R68: a declined (or refused) ask step is the step's stored `unsuccessful` ending: the ENGINE posts the team notice (the step, the typed
 * reason, the facts the old hand-drawn `team.declined-notice` carried) and follows the policy; no `if` + notice pair is drawn any more.
 */
const expectUnsuccessful = (graph: TemplateGraph, wiring: UnsuccessfulWiring): void => {
    const step = stepOf(graph, wiring.step)
    if (step.kind !== "node") throw new Error(`${wiring.step} is no node step`)
    expect(step.next ?? null).toBe(wiring.next)
    expect(step.unsuccessful).toEqual({
        then: wiring.then,
        ...(wiring.outcome === undefined ? {} : { outcome: wiring.outcome }),
        facts: wiring.facts.map(([vi, at]) => ({
            label: expect.objectContaining({ vi }),
            value: expect.objectContaining({ $ref: at }),
        })),
    })
    if (wiring.outcome === undefined) return
    const end = stepOf(graph, wiring.outcome)
    if (end.kind !== "outcome") throw new Error(`${wiring.outcome} is no outcome`)
    expect(end.params.outcome).toBe("declined")
}

/** R68: no graph draws the shared declined notice any more (the engine reports). */
const expectNoNotice = (graph: TemplateGraph): void => {
    expect(graph.spec.nodes.filter((step) => step.kind === "node" && step.step === "team.declined-notice")).toEqual([])
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

    // R57: + MISA meInvoice, the e-invoice service the invoice is issued on.
    it("works with the CRM, the bank feeds, the sending mailbox and the e-invoice service; the invoice is primary", () => {
        expect(webbooksAgent.key).toBe("webbooks")
        expect(webbooksAgent.accounts).toEqual(WEBBOOKS_PROVIDERS)
        expect(WEBBOOKS_PROVIDERS).toEqual([
            CRM_NIVOWEB_PROVIDER,
            PROVIDER.sepay,
            PROVIDER.casso,
            PROVIDER.smtp,
            PROVIDER.misaMeinvoice,
        ])
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
    it("is version 12, reached by a call, open to any caller", () => {
        // ledger 2026-11-13 (`nivo-frame.rights`): every graph's catalogue version + 1 (one mode per node changed every compiled document).
        // 2026-11-14 (R57): 10, the issue on the MISA account, the issued invoice recorded in the CRM.
        // 2026-11-14 (R68): 11, the declined draft / issue are the steps' unsuccessful ending (the engine tells the team).
        // 2026-11-14 (E-R57): 12, the invoice is recorded with MISA's own `issuedOn`.
        expect(invoiceGraph.spec.catalogue?.version).toBe(12)
        expect(invoiceGraph.key).toBe("webbooks.invoice")
        expect(invoiceGraph.spec.triggers).toEqual([{ verb: TRIGGER.workflowCalled }])
        expect(invoiceGraph.spec.entry.openTo).toBe("any")
    })

    // R57: an issued invoice with a number is recorded in the CRM first; `invoiced` needs that record, else `not-invoiced`.
    it("drafts, issues, records and mails an issued invoice only, tells the team on every path", () => {
        expect(stepsOf(invoiceGraph)).toEqual([
            ["draft", "webbooks.invoice-draft"],
            ["issue", "webbooks.invoice-issue"],
            ["issued", "if"],
            ["record", "webbooks.issue-record"],
            ["mail", "webbooks.invoice-mail"],
            ["team", "webbooks.invoice-team"],
            ["team-declined", "if"],
            ["recorded", "if"],
            ["invoiced", "outcome"],
            ["not-invoiced", "outcome"],
            ["declined", "outcome"],
        ])
    })

    // R68: the `draft-declined`/`draft-notice` and `issue-declined`/`issue-notice` pairs became the steps' unsuccessful ending.
    it("a declined draft or a declined issue tells the team and ends declined; nothing after it runs", () => {
        const facts = [["Mã dịch vụ", "trigger.data.serviceCode"]] as const
        expectUnsuccessful(invoiceGraph, { step: "draft", next: "issue", then: "end", outcome: "declined", facts })
        expectUnsuccessful(invoiceGraph, { step: "issue", next: "issued", then: "end", outcome: "declined", facts })
        expectNoNotice(invoiceGraph)
    })

    it("a declined team post ends declined with no notice (the declined write is itself a team post)", () => {
        // R57: past the team line `recorded` decides `invoiced` / `not-invoiced` (was: straight to `invoiced`).
        expectTeamDeclined(invoiceGraph, { step: "team", check: "team-declined", yes: "declined", no: "recorded" })
    })
})

describe("webbooks.payment", () => {
    it("is version 12, woken by a bank credit on SePay or Casso, open to any caller", () => {
        // 2026-11-14: version 11 reads the credit's row id from the event's data (`trigger.data.transactionId`, the one event pipeline).
        // 2026-11-14 (R68): 12, a declined record of money is the record step's unsuccessful ending.
        expect(paymentGraph.spec.catalogue?.version).toBe(12)
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
                ["declined", "outcome"],
            ]),
        )
        // R68: 16 -> 12 (the two declined ifs and their notices are gone).
        expect(paymentGraph.spec.nodes).toHaveLength(12)
        expect(paymentGraph.spec.nodes[0].key).toBe("credit")
    })

    // R68: the `record-`/`purchase-declined` ifs and their notices became the record steps' unsuccessful ending.
    it("a declined record of money tells the team and ends declined: no team line, no hand-off", () => {
        expectUnsuccessful(paymentGraph, {
            step: "record",
            next: "record-team",
            then: "end",
            outcome: "declined",
            facts: [["Mã dịch vụ", "steps.match.output.serviceCode"]],
        })
        expectUnsuccessful(paymentGraph, {
            step: "purchase",
            next: "purchase-team",
            then: "end",
            outcome: "declined",
            facts: [["Mã đơn mua", "steps.match.output.purchaseCode"]],
        })
        expectNoNotice(paymentGraph)
    })

    it("a declined team line is a side line: it skips that line only and the hand-off runs (the money is recorded)", () => {
        expect(stepOf(paymentGraph, "record-team")).toMatchObject({ next: "to-renew" })
        expect(stepOf(paymentGraph, "purchase-team")).toMatchObject({ next: "to-sales" })
        expect(paymentGraph.spec.nodes.some((step) => step.key === "record-team-declined")).toBe(false)
        expect(paymentGraph.spec.nodes.some((step) => step.key === "purchase-team-declined")).toBe(false)
    })
})

describe("webbooks.debt-round", () => {
    it("is version 8, woken by the weekday 09:00 clock, open to the agent only", () => {
        // ledger 2026-11-13 (`nivo-frame.rights`): every graph's catalogue version + 1 (one mode per node changed every compiled document).
        // 2026-11-14 (R68): 8, a declined notice record is the record step's unsuccessful ending.
        expect(debtRoundGraph.spec.catalogue?.version).toBe(8)
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
                ["report", "webbooks.round-report"],
                ["report-declined", "if"],
                ["reminded", "outcome"],
                ["nothing-due", "outcome"],
                ["declined", "outcome"],
            ]),
        )
        // R68: 14 -> 12 (the declined if and its notice are gone).
        expect(debtRoundGraph.spec.nodes).toHaveLength(12)
    })

    // R68: the `record-declined`/`record-notice` pair became the record step's unsuccessful ending (continue: the item ends there).
    it("a declined record tells the team and ends its item only; the round goes on to the report", () => {
        expectUnsuccessful(debtRoundGraph, { step: "record", next: null, then: "continue", facts: [["Mã dự án", "item.projectCode"]] })
        expect(stepOf(debtRoundGraph, "record")).toMatchObject({ loop: "each" })
        expectNoNotice(debtRoundGraph)
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
    it("is version 8, reached by a call, open to any caller", () => {
        // ledger 2026-11-13 (`nivo-frame.rights`): every graph's catalogue version + 1 (one mode per node changed every compiled document).
        // 2026-11-14 (R68): 8, a declined note is the note step's unsuccessful ending.
        expect(supplierInvoicesGraph.spec.catalogue?.version).toBe(8)
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
                ["report", "webbooks.supplier-report"],
                ["report-declined", "if"],
                ["checked", "outcome"],
                ["declined", "outcome"],
            ]),
        )
        // R68: 10 -> 8 (the declined if and its notice are gone).
        expect(supplierInvoicesGraph.spec.nodes).toHaveLength(8)
    })

    // R68: the `note-declined`/`note-notice` pair became the note step's unsuccessful ending (continue: the item ends there).
    it("a declined note tells the team and ends its item only; the report reads every item from the note", () => {
        expectUnsuccessful(supplierInvoicesGraph, {
            step: "note",
            next: null,
            then: "continue",
            facts: [["Số hoá đơn", "steps.check.output.invoiceNo"]],
        })
        expectNoNotice(supplierInvoicesGraph)
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
