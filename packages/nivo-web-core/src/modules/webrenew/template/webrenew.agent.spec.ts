import type { GraphV2Step } from "@nivo-lite/agent-sdk/graph"
import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateGraph,
    type TemplateTriggerLookup,
    templateAgentProblems,
    templateGraphProblems,
} from "@nivo-lite/agent-sdk/template"
import { CRM_NIVOWEB_PROVIDER } from "../../../crm/nivoweb/api.generated"
import { WEBRENEW_PROVIDERS } from "../webrenew.accounts"
import { answerGraph } from "./answer.graph"
import { mailRepliesGraph } from "./mail-replies.graph"
import { renewGraph } from "./renew.graph"
import { roundGraph } from "./round.graph"
import { teamChatGraph } from "./team-chat.graph"
import { webrenewAgent } from "./webrenew.agent"

/** The engine's trigger lookup as this spec assumes it: the clock supplies its preset, a workflow call what its caller maps. */
const triggers: TemplateTriggerLookup = {
    supplies: (verb) => {
        if (verb === TRIGGER.workflowCalled) return { kind: "caller" }
        if (verb === TRIGGER.clockTick) return { kind: "fixed", params: [{ name: "preset", type: "string" }] }
        // R53 (one-run answer): the talk's wait takes the customer's next Zalo message: the generic members of a channel message on the
        // one event pipeline, as the webdesk spec's lookup states them.
        if (verb === TRIGGER.zaloMessageReceived) {
            return {
                kind: "fixed",
                params: [
                    { name: "eventId", type: "string" },
                    { name: "accountId", type: "string" },
                    { name: "contactId", type: "string" },
                    { name: "routeId", type: "string" },
                    { name: "subject", type: "object" },
                    { name: "data", type: "object" },
                ],
            }
        }
        return { kind: "unknown" }
    },
}

/** A graph's steps by key, each with its kind and, for a node step, its node id. */
const stepsOf = (graph: TemplateGraph): ReadonlyArray<readonly [string, string]> =>
    graph.spec.nodes.map((step) => [step.key, step.kind === "node" ? step.step : step.kind] as const)

/** The trigger verbs of a graph. */
const verbsOf = (graph: TemplateGraph): ReadonlyArray<string> => graph.spec.triggers.map((one) => one.verb)

/** A graph's compiled step by key, or a failed expectation. */
const stepOf = (graph: TemplateGraph, key: string): GraphV2Step => {
    const step = graph.spec.nodes.find((one) => one.key === key)
    if (step === undefined) throw new Error(`no step ${key} in ${graph.key}`)
    return step
}

/** What a step's unsuccessful ending declares (R68): the policy, the outcome it ends at (or null) and its facts' labels and refs. */
interface Unsuccessful {
    readonly step: string
    readonly then: "continue" | "end"
    readonly outcome: string | null
    /** The loop whose body holds the step, or null outside a loop. */
    readonly loop: string | null
    /** Each fact: its vi label and the ref it reads. */
    readonly facts: ReadonlyArray<readonly [string, string]>
}

/**
 * R68 (the engine reports): a declined approval (or the step's `cannot`) is the step's unsuccessful ending: the ENGINE posts the team
 * notice with the declared facts and follows `then`. No graph of the agent draws `team.declined-notice` any more.
 */
const expectUnsuccessful = (graph: TemplateGraph, wiring: Unsuccessful): void => {
    const step = stepOf(graph, wiring.step)
    expect(step.kind).toBe("node")
    if (step.kind !== "node") return
    expect(step.loop ?? null).toBe(wiring.loop)
    expect(step.unsuccessful?.then).toBe(wiring.then)
    expect(step.unsuccessful?.outcome ?? null).toBe(wiring.outcome)
    expect(step.unsuccessful?.facts.map((fact) => ["vi" in fact.label ? fact.label.vi : null, fact.value])).toEqual(
        wiring.facts.map(([label, at]) => [label, objectLike({ $ref: at })]),
    )
    if (wiring.outcome === null) return
    const end = stepOf(graph, wiring.outcome)
    expect(end.kind === "outcome" ? end.params.outcome : undefined).toBe("declined")
}

/** The notice node the graphs drew before R68. */
const NOTICE = "team.declined-notice"

/** `expect.objectContaining` as the `unknown` a matcher slot takes. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

describe("the Renewal agent template (webrenew)", () => {
    it("loads with no problem, every graph judged with the agent's providers, the triggers' supplies and strict nullability", () => {
        expect(templateAgentProblems(webrenewAgent, { triggers })).toEqual([])
        for (const graph of webrenewAgent.graphs) {
            expect(
                templateGraphProblems(graph.spec, {
                    nodes: graph.nodes,
                    agentAccounts: webrenewAgent.accounts,
                    triggers,
                    nullability: "strict",
                }),
            ).toEqual([])
        }
    })

    // R57: + the domain registrars (iNET, Tino) the renewal renews at.
    it("works with the CRM, the messaging accounts, the sending mailbox and the registrars; the round is primary", () => {
        expect(webrenewAgent.key).toBe("webrenew")
        expect(webrenewAgent.accounts).toEqual(WEBRENEW_PROVIDERS)
        expect(WEBRENEW_PROVIDERS).toEqual([
            CRM_NIVOWEB_PROVIDER,
            PROVIDER.zaloOa,
            PROVIDER.telegram,
            PROVIDER.meta,
            PROVIDER.smtp,
            PROVIDER.inet,
            PROVIDER.tino,
        ])
        expect(webrenewAgent.accounts).not.toContain(PROVIDER.nivo)
        expect(webrenewAgent.primary).toBe(roundGraph.key)
        expect(webrenewAgent.graphs.map((graph) => graph.key)).toEqual([
            "webrenew.round",
            "webrenew.answer",
            "webrenew.mail-replies",
            "webrenew.renew",
            "webrenew.team-chat",
        ])
    })

    it("carries each graph's catalogue on the compiled graph: the version it ships, its name as its title", () => {
        const rows = [
            // ledger 2026-11-13 (`nivo-frame.rights`): every graph's catalogue version + 1 (one mode per node changed every compiled document).
            // 2026-11-13 later (D-5): round, answer, renew + 1 (NIVO Web `auto` almost everywhere)
            // 2026-11-14 (one event pipeline): round + 1 (the generic trigger scope); answer, mail replies and renew + 1 (the caller's params
            // in `trigger.data`), answer and renew after one more bump of the same day.
            // 2026-11-14 04:50 (design moved): answer, mail replies and renew + 1, their trigger carries no `burst` (settle is the declaration's).
            // 2026-11-14 (R68, the engine reports): round, answer and mail replies + 1 (notice pairs gone, labels); renew stays 13 (never
            // shipped: R68 folded into its notes).
            [roundGraph, 8],
            // 2026-11-13: answer 7 and renew 6, the declined approval's outcome renamed `declined` (flipDecisions2026_11_13); then + 1 each
            // 2026-11-13: answer + 1 again (NW-1: the customer sends without a mail path, `close-thank`, `reply-answer`, `paid-ack`, declare `auto`)
            // 2026-11-14 (R53, the conversation as one run): the answer is a talk loop, version 14.
            // 2026-11-14 (ask ONE write): answer 16, the quote send is split by channel (`tell`, `tell-mail`, `tell-told`).
            [answerGraph, 16],
            [mailRepliesGraph, 8],
            // 2026-11-14 (EF-G): renew + 1 (a declined team post ends `declined`)
            // 2026-11-14 (R57): renew 13, the registrar renews and the CRM records; only a renewed service tells the customer and invoices.
            // 2026-11-14 (E-R57): renew 14, a pending order is read again (`settle`, `settled`).
            [renewGraph, 14],
            // 2026-11-14 (EF-G): the chat turn + 1 (a declined answer post ends the turn `declined`)
            [teamChatGraph, 5],
        ] as const
        for (const [graph, version] of rows) {
            expect(graph.spec.catalogue?.version).toBe(version)
            expect(graph.spec.catalogue?.name).toEqual(graph.spec.title)
        }
    })

    it("the round: the clock at 08:00, then due \u2192 each (send \u2192 sent? \u2192 record) \u2192 report \u2192 rounded", () => {
        expect(verbsOf(roundGraph)).toEqual([TRIGGER.clockTick])
        expect(roundGraph.spec.triggers[0]?.args).toEqual({ preset: "daily_at", at: "08:00" })
        expect(stepsOf(roundGraph)).toEqual([
            ["due", "webrenew.due"],
            ["each", "loop"],
            // R68: the declined send / record pairs (if + notice) are the steps' unsuccessful endings now.
            ["send", "webrenew.remind-send"],
            ["sent", "if"],
            ["record", "webrenew.remind-record"],
            ["report", "webrenew.round-report"],
            ["rounded", "outcome"],
        ])
    })

    it("the answer: a workflow call, understood then routed four ways", () => {
        expect(verbsOf(answerGraph)).toEqual([TRIGGER.workflowCalled])
        // R53 (the conversation as one run): v13's understand and ask steps inside the talk loop (`talk`), each round first taking the
        // message (round 1: the hand-off; later: `hear` -> the front door's own `desk` judgement -> `give-back` when not about a renewal
        // -> `message`); agree, paid and no end the talk and run after it, read from its `last` (`settled`, `*-said`).
        expect(stepsOf(answerGraph)).toEqual([
            ["talk", "loop"],
            ["opening", "if"],
            ["hear", "wait"],
            ["desk", "webdesk.understand-sales"],
            ["give-back", "hand-back"],
            ["message", "webrenew.round-message"],
            ["understand", "webrenew.understand-open"],
            // R68: `reply-notice`, `open-declined` + `open-notice`, `tell-notice`, `record-declined` + `record-notice`,
            // `close-declined` + `close-notice`, `paid-declined` + `paid-notice` are gone (the steps' unsuccessful endings).
            ["reply", "webrenew.reply-answer"],
            ["reply-declined", "if"],
            ["linked", "if"],
            ["unlinked-tell", "webrenew.unlinked-tell"],
            ["settled", "if"],
            ["declined-said", "if"],
            ["agree-said", "if"],
            ["paid-said", "if"],
            ["open-each", "loop"],
            ["open", "webrenew.quote-open"],
            ["tell", "webrenew.quote-tell"],
            // v16 (ask ONE write): the quote send is split by channel; `tell-told` merges the two for the steps after.
            ["tell-mail", "webrenew.quote-tell-mail"],
            ["tell-told", "webrenew.quote-told"],
            ["tell-declined", "if"],
            ["record-each", "loop"],
            ["record", "webrenew.quote-record"],
            ["close-each", "loop"],
            ["close-record", "webrenew.close-record"],
            ["close-team", "webrenew.close-team"],
            ["close-thank", "webrenew.close-thank"],
            ["declined", "outcome"],
            ["answered", "outcome"],
            ["paid-team", "webrenew.paid-team"],
            ["paid-ack", "webrenew.paid-ack"],
        ])
    })

    it("the mail replies, the renewal and the team chat: each a workflow call", () => {
        expect(verbsOf(mailRepliesGraph)).toEqual([TRIGGER.workflowCalled])
        expect(stepsOf(mailRepliesGraph)).toEqual([
            ["each", "loop"],
            // R68: `record-notice` is the record's unsuccessful ending; `record-declined` stays (it ends the mail with no team line).
            ["record", "webrenew.mail-reply-record"],
            ["record-declined", "if"],
            ["team", "webrenew.mail-reply-team"],
            ["recorded", "outcome"],
        ])
        expect(verbsOf(renewGraph)).toEqual([TRIGGER.workflowCalled])
        // R57: check -> renew (registrar) -> record (CRM) -> team; only `renewed` tells the customer and invoices, else `not-renewed`.
        expect(stepsOf(renewGraph)).toEqual([
            ["check", "webrenew.renew-check"],
            // R68: `renew-declined` + `renew-notice` are the renewal's unsuccessful ending (end at `declined`).
            ["renew", "webrenew.renew"],
            ["declined", "outcome"],
            // E-R57: a pending order is read again by the `settle` loop (its body step `recheck` is inside the loop).
            ["settle", "loop"],
            ["recheck", "webrenew.renew-recheck"],
            ["settled", "if"],
            ["record", "webrenew.renew-record"],
            ["renewed-team", "webrenew.renewed-team"],
            ["renewed-team-declined", "if"],
            ["renewed-check", "if"],
            ["renewed-tell", "webrenew.renewed-tell"],
            ["to-invoice", "call-workflow"],
            ["renewed", "outcome"],
            ["not-renewed", "outcome"],
        ])
        expect(verbsOf(teamChatGraph)).toEqual([TRIGGER.workflowCalled])
        expect(stepsOf(teamChatGraph)).toEqual([
            ["answer", "webrenew.team-answer"],
            ["has-proposal", "if"],
            ["propose", "team.truth-propose"],
            ["post", "team.answer-post"],
            ["post-declined", "if"],
            ["declined", "outcome"],
        ])
    })
})

describe("a declined approval in the Renewal graphs (the owner's rule: a decision, never a failure; R68: the engine reports it)", () => {
    it("no graph of the agent draws the declined notice node any more", () => {
        for (const graph of [roundGraph, answerGraph, mailRepliesGraph, renewGraph]) {
            expect(stepsOf(graph).filter(([, step]) => step === NOTICE)).toEqual([])
        }
    })

    it("the round: a declined send or record is told by the engine with the service's code and ends that item; the round goes on", () => {
        expectUnsuccessful(roundGraph, { step: "send", then: "continue", outcome: null, loop: "each", facts: [["Mã dịch vụ", "item.serviceCode"]] })
        expectUnsuccessful(roundGraph, { step: "record", then: "continue", outcome: null, loop: "each", facts: [["Mã dịch vụ", "item.serviceCode"]] })
        // a declined send answers `sent: false`: the `sent` check ends the item; the record has no `next` (the item ends after it)
        const send = stepOf(roundGraph, "send")
        expect(send.kind === "node" ? send.next : undefined).toBe("sent")
        const record = stepOf(roundGraph, "record")
        expect(record.kind === "node" ? record.next ?? null : undefined).toBeNull()
        // the loop still collects the record, so the report names a declined record as not recorded
        const each = stepOf(roundGraph, "each")
        expect(each.kind === "loop" ? each.params : undefined).toMatchObject({ collect: "record" })
    })

    it("the answer: the three loops end the declined item; tell, reply and paid-ack end the run `declined`", () => {
        expectUnsuccessful(answerGraph, { step: "open", then: "continue", outcome: null, loop: "open-each", facts: [["Mã dịch vụ", "item"]] })
        expectUnsuccessful(answerGraph, { step: "record", then: "continue", outcome: null, loop: "record-each", facts: [["Mã dịch vụ", "item"]] })
        expectUnsuccessful(answerGraph, { step: "close-record", then: "continue", outcome: null, loop: "close-each", facts: [["Mã dịch vụ", "item"]] })
        expectUnsuccessful(answerGraph, {
            step: "tell",
            then: "end",
            outcome: "declined",
            loop: null,
            facts: [["Mã khách hàng", "steps.talk.output.last.customerCode"]],
        })
        expectUnsuccessful(answerGraph, {
            step: "paid-ack",
            then: "end",
            outcome: "declined",
            loop: null,
            facts: [["Mã khách hàng", "steps.talk.output.last.customerCode"]],
        })
        // R53 + R68: `reply` sits in the talk (an `until` body, where an `end` is not taken): the engine tells the team and the step goes on
        // to `reply-declined`, which ends the round; the talk's `until` ends the talk and `declined-said` reaches `declined` on the reply's
        // own `declined`.
        expectUnsuccessful(answerGraph, {
            step: "reply",
            then: "continue",
            outcome: null,
            loop: "talk",
            facts: [["Mã khách hàng", "steps.understand.output.customerCode"]],
        })
        const reply = stepOf(answerGraph, "reply")
        expect(reply.kind === "node" ? reply.next : undefined).toBe("reply-declined")
        const replyCheck = stepOf(answerGraph, "reply-declined")
        expect(replyCheck.kind === "if" ? [replyCheck.routes.yes ?? null, replyCheck.routes.no] : undefined).toEqual([null, "linked"])
        expect(stepOf(answerGraph, "declined-said")).toMatchObject({
            params: { when: { op: "eq", ref: objectLike({ $ref: "steps.talk.output.last.declined" }), value: true } },
            routes: { yes: "declined", no: "answered" },
        })
        // `tell-declined` is business, kept: every request declined (each told by the engine) leaves nothing to quote -> `declined`
        const tellCheck = stepOf(answerGraph, "tell-declined")
        expect(tellCheck.kind === "if" ? [tellCheck.routes.yes, tellCheck.routes.no] : undefined).toEqual(["declined", "record-each"])
        // the one outcome `declined` is reached by the customer's no (close-thank); a declined step reaches it through its option
        const declinedEnds = answerGraph.spec.nodes.filter((one) => one.kind === "node" && one.next === "declined")
        expect(declinedEnds.map((one) => one.key)).toEqual(["close-thank"])
    })

    it("the renewal: a declined team post ends `declined` with no notice; the customer is not told and Accounting is not called", () => {
        const team = stepOf(renewGraph, "renewed-team")
        expect(team.kind === "node" ? team.next : undefined).toBe("renewed-team-declined")
        const check = stepOf(renewGraph, "renewed-team-declined")
        expect(check.kind).toBe("if")
        if (check.kind !== "if") return
        expect(check.params.when).toEqual({
            op: "eq",
            ref: objectLike({ $ref: "steps.renewed-team.output.declined" }),
            value: true,
        })
        expect(check.routes.yes).toBe("declined")
        // R57: past the team line the `renewed-check` decides whether the customer is told (was: straight to `renewed-tell`).
        expect(check.routes.no).toBe("renewed-check")
        const end = stepOf(renewGraph, "declined")
        expect(end.kind === "outcome" ? end.params.outcome : undefined).toBe("declined")
    })

    it("the mail replies: a declined record is told by the engine and ends that mail; the team line runs only otherwise", () => {
        expectUnsuccessful(mailRepliesGraph, {
            step: "record",
            then: "continue",
            outcome: null,
            loop: "each",
            facts: [
                ["Mã dịch vụ", "item.serviceCode"],
                ["Mã khách hàng", "item.customerCode"],
            ],
        })
        const check = stepOf(mailRepliesGraph, "record-declined")
        expect(check.kind === "if" ? [check.routes.yes ?? null, check.routes.no] : undefined).toEqual([null, "team"])
    })

    it("the renewal (money): a declined renewal is told by the engine and ends `declined`; the customer and Accounting hear nothing", () => {
        expectUnsuccessful(renewGraph, {
            step: "renew",
            then: "end",
            outcome: "declined",
            loop: null,
            facts: [["Mã dịch vụ", "trigger.data.serviceCode"]],
        })
        // R57 / E-R57: a pending order is read again (`settle`), then the registrar's answer is recorded in the CRM before the team line.
        const renew = stepOf(renewGraph, "renew")
        expect(renew.kind === "node" ? renew.next : undefined).toBe("settle")
    })
})

describe("the webrenew catalogues' seedActive", () => {
    it("mirrors the old JSON template of every graph: active at seed exactly where the JSON said `seedActive: true`", () => {
        const seeded = webrenewAgent.graphs.map(
            (graph) => [graph.key, graph.spec.catalogue?.seedActive === true] as const,
        )
        expect([...seeded].sort(([a], [b]) => a.localeCompare(b))).toEqual([
            ["webrenew.answer", true],
            ["webrenew.mail-replies", true],
            ["webrenew.renew", true],
            ["webrenew.round", false],
            ["webrenew.team-chat", true],
        ])
    })
})
