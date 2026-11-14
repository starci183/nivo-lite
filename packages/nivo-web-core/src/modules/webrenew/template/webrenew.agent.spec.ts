import type { GraphV2Step } from "@nivo-lite/agent-sdk/graph"
import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateGraph,
    type TemplateTriggerLookup,
    templateAgentProblems,
    templateGraphProblems,
} from "@nivo-lite/agent-sdk/template"
import { CRM_NIVOWEB_PROVIDER } from "../../../crm/nivoweb/api.generated"
import { webrenewText } from "../copy"
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

/** The shared notice of a declined approval (blocks-core `team.declined-notice`). */
const NOTICE = "team.declined-notice"

/** A graph's compiled step by key, or a failed expectation. */
const stepOf = (graph: TemplateGraph, key: string): GraphV2Step => {
    const step = graph.spec.nodes.find((one) => one.key === key)
    if (step === undefined) throw new Error(`no step ${key} in ${graph.key}`)
    return step
}

/** What a blocking ask step's declined wiring names: the check, the notice (with the step's vi title) and the end. */
interface DeclinedWiring {
    readonly step: string
    readonly check: string
    readonly notice: string
    /** The `declined` outcome's key, or null: inside a loop body the item ends after the notice. */
    readonly end: string | null
    /** The loop whose body holds the step, or null outside a loop. */
    readonly loop: string | null
    /** The plain (vi) title of the declined step, bound into the notice. */
    readonly title: string
}

/**
 * The declined wiring of a blocking ask step, as compiled data: the step goes to an `if` that holds exactly when its `declined` is
 * true, whose yes is the shared notice (`team.declined-notice`, the step's vi title bound), which goes on to the `declined` outcome
 * or, in a loop body, nowhere (the item ends, the loop goes on).
 */
const expectDeclinedWiring = (graph: TemplateGraph, wiring: DeclinedWiring): void => {
    const step = stepOf(graph, wiring.step)
    expect(step.kind === "node" ? step.next : undefined).toBe(wiring.check)
    expect(step.loop ?? null).toBe(wiring.loop)
    const check = stepOf(graph, wiring.check)
    expect(check.kind).toBe("if")
    if (check.kind !== "if") return
    expect(check.params.when).toEqual({
        op: "eq",
        ref: { $ref: `steps.${wiring.step}.output.declined`, default: null },
        value: true,
    })
    expect(check.routes.yes).toBe(wiring.notice)
    const notice = stepOf(graph, wiring.notice)
    expect(notice.kind).toBe("node")
    if (notice.kind !== "node") return
    expect(notice.step).toBe(NOTICE)
    expect(notice.loop ?? null).toBe(wiring.loop)
    expect(notice.params["step"]).toEqual(wiring.title)
    expect(notice.params["locale"]).toBe("vi")
    // a notice inside a loop body says only that ITEM stopped; outside a loop, the run (the default, unbound)
    expect(notice.params["scope"]).toBe(wiring.loop === null ? undefined : "item")
    expect(notice.next ?? null).toBe(wiring.end)
    if (wiring.end === null) return
    const end = stepOf(graph, wiring.end)
    expect(end.kind).toBe("outcome")
    if (end.kind !== "outcome") return
    expect(end.params.outcome).toBe("declined")
}

/** The vi title of a Renewal step, as the notice binds it. */
const titleOf = (key: Parameters<typeof webrenewText>[0]): string => webrenewText(key).vi

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

    it("works with the CRM, the messaging accounts and the sending mailbox; the round is primary", () => {
        expect(webrenewAgent.key).toBe("webrenew")
        expect(webrenewAgent.accounts).toEqual(WEBRENEW_PROVIDERS)
        expect(WEBRENEW_PROVIDERS).toEqual([
            CRM_NIVOWEB_PROVIDER,
            PROVIDER.zaloOa,
            PROVIDER.telegram,
            PROVIDER.meta,
            PROVIDER.smtp,
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
            [roundGraph, 7],
            // 2026-11-13: answer 7 and renew 6, the declined approval's outcome renamed `declined` (flipDecisions2026_11_13); then + 1 each
            // 2026-11-13: answer + 1 again (NW-1: the customer sends without a mail path, `close-thank`, `reply-answer`, `paid-ack`, declare `auto`)
            // 2026-11-14 (R53, the conversation as one run): the answer is a talk loop, version 14.
            [answerGraph, 14],
            [mailRepliesGraph, 7],
            // 2026-11-14 (EF-G): renew + 1 (a declined team post ends `declined`)
            [renewGraph, 12],
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
            ["send", "webrenew.remind-send"],
            ["send-declined", "if"],
            ["send-notice", NOTICE],
            ["sent", "if"],
            ["record", "webrenew.remind-record"],
            ["record-declined", "if"],
            ["record-notice", NOTICE],
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
            ["reply", "webrenew.reply-answer"],
            ["reply-declined", "if"],
            ["reply-notice", NOTICE],
            ["linked", "if"],
            ["unlinked-tell", "webrenew.unlinked-tell"],
            ["settled", "if"],
            ["declined-said", "if"],
            ["agree-said", "if"],
            ["paid-said", "if"],
            ["open-each", "loop"],
            ["open", "webrenew.quote-open"],
            ["open-declined", "if"],
            ["open-notice", NOTICE],
            ["tell", "webrenew.quote-tell"],
            ["tell-declined", "if"],
            ["tell-notice", NOTICE],
            ["record-each", "loop"],
            ["record", "webrenew.quote-record"],
            ["record-declined", "if"],
            ["record-notice", NOTICE],
            ["close-each", "loop"],
            ["close-record", "webrenew.close-record"],
            ["close-declined", "if"],
            ["close-notice", NOTICE],
            ["close-team", "webrenew.close-team"],
            ["close-thank", "webrenew.close-thank"],
            ["declined", "outcome"],
            ["answered", "outcome"],
            ["paid-team", "webrenew.paid-team"],
            ["paid-ack", "webrenew.paid-ack"],
            ["paid-declined", "if"],
            ["paid-notice", NOTICE],
        ])
    })

    it("the mail replies, the renewal and the team chat: each a workflow call", () => {
        expect(verbsOf(mailRepliesGraph)).toEqual([TRIGGER.workflowCalled])
        expect(stepsOf(mailRepliesGraph)).toEqual([
            ["each", "loop"],
            ["record", "webrenew.mail-reply-record"],
            ["record-declined", "if"],
            ["record-notice", NOTICE],
            ["team", "webrenew.mail-reply-team"],
            ["recorded", "outcome"],
        ])
        expect(verbsOf(renewGraph)).toEqual([TRIGGER.workflowCalled])
        expect(stepsOf(renewGraph)).toEqual([
            ["renew", "webrenew.renew"],
            ["renew-declined", "if"],
            ["renew-notice", NOTICE],
            ["declined", "outcome"],
            ["renewed-team", "webrenew.renewed-team"],
            ["renewed-team-declined", "if"],
            ["renewed-tell", "webrenew.renewed-tell"],
            ["to-invoice", "call-workflow"],
            ["renewed", "outcome"],
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

describe("a declined approval in the Renewal graphs (the owner's rule: a decision, never a failure)", () => {
    it("the round: a declined send or record tells the team and ends that service's item; the round goes on", () => {
        const loop = "each"
        expectDeclinedWiring(roundGraph, {
            step: "send",
            check: "send-declined",
            notice: "send-notice",
            end: null,
            loop,
            title: titleOf("node.remindSend.title"),
        })
        expectDeclinedWiring(roundGraph, {
            step: "record",
            check: "record-declined",
            notice: "record-notice",
            end: null,
            loop,
            title: titleOf("node.remindRecord.title"),
        })
        // the send's other branch is the round's `sent` check; the record's has none (the item ends after the record)
        const sendCheck = stepOf(roundGraph, "send-declined")
        expect(sendCheck.kind === "if" ? sendCheck.routes.no : undefined).toBe("sent")
        const recordCheck = stepOf(roundGraph, "record-declined")
        expect(recordCheck.kind === "if" ? recordCheck.routes.no : undefined).toBeUndefined()
        // the loop still collects the record, so the report names a declined record as not recorded
        const each = stepOf(roundGraph, "each")
        expect(each.kind === "loop" ? each.params : undefined).toMatchObject({ collect: "record" })
    })

    it("the answer: the three loops end the declined item; tell, reply and paid-ack end the run `declined`", () => {
        expectDeclinedWiring(answerGraph, {
            step: "open",
            check: "open-declined",
            notice: "open-notice",
            end: null,
            loop: "open-each",
            title: titleOf("node.quoteOpen.title"),
        })
        expectDeclinedWiring(answerGraph, {
            step: "record",
            check: "record-declined",
            notice: "record-notice",
            end: null,
            loop: "record-each",
            title: titleOf("node.quoteRecord.title"),
        })
        expectDeclinedWiring(answerGraph, {
            step: "close-record",
            check: "close-declined",
            notice: "close-notice",
            end: null,
            loop: "close-each",
            title: titleOf("node.close.title"),
        })
        expectDeclinedWiring(answerGraph, {
            step: "tell",
            check: "tell-declined",
            notice: "tell-notice",
            end: "declined",
            loop: null,
            title: titleOf("node.quoteTell.title"),
        })
        // R53: `reply` sits in the talk; a person's decline stops the conversation as it stopped the run of v13: its notice is the
        // run's (no `scope: item`) and ends the round (no `next`), the talk's `until` then ends the talk and `declined-said` reaches
        // `declined`.
        const reply = stepOf(answerGraph, "reply")
        expect(reply.kind === "node" ? [reply.next, reply.loop] : undefined).toEqual(["reply-declined", "talk"])
        const replyNotice = stepOf(answerGraph, "reply-notice")
        expect(replyNotice.kind === "node" ? [replyNotice.step, replyNotice.params["scope"], replyNotice.next ?? null] : undefined).toEqual([
            NOTICE,
            undefined,
            null,
        ])
        expect(replyNotice.kind === "node" ? replyNotice.params["step"] : undefined).toEqual(titleOf("node.reply.title"))
        expect(stepOf(answerGraph, "declined-said")).toMatchObject({ routes: { yes: "declined", no: "answered" } })
        expectDeclinedWiring(answerGraph, {
            step: "paid-ack",
            check: "paid-declined",
            notice: "paid-notice",
            end: "declined",
            loop: null,
            title: titleOf("node.paidAck.title"),
        })
        const tellCheck = stepOf(answerGraph, "tell-declined")
        expect(tellCheck.kind === "if" ? tellCheck.routes.no : undefined).toBe("record-each")
        // ledger 2026-11-13 (flipDecisions2026_11_13: a declined approval ends with outcome `declined`): the one outcome `declined`
        // is reached by the customer's no (close-thank) and by the three notices of a person's decline outside a loop
        const declinedEnds = answerGraph.spec.nodes.filter((one) => one.kind === "node" && one.next === "declined")
        // R53: `reply-notice` now ends its round inside the talk (see above); the other three still end at `declined`.
        expect(declinedEnds.map((one) => one.key)).toEqual(["tell-notice", "close-thank", "paid-notice"])
        const replyCheck = stepOf(answerGraph, "reply-declined")
        expect(replyCheck.kind === "if" ? replyCheck.routes.no : undefined).toBe("linked")
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
        expect(check.routes.no).toBe("renewed-tell")
        const end = stepOf(renewGraph, "declined")
        expect(end.kind === "outcome" ? end.params.outcome : undefined).toBe("declined")
    })

    it("the mail replies: a declined record tells the team and ends that mail; the team line runs only otherwise", () => {
        expectDeclinedWiring(mailRepliesGraph, {
            step: "record",
            check: "record-declined",
            notice: "record-notice",
            end: null,
            loop: "each",
            title: titleOf("node.mailReply.title"),
        })
        const check = stepOf(mailRepliesGraph, "record-declined")
        expect(check.kind === "if" ? check.routes.no : undefined).toBe("team")
    })

    it("the renewal (money): a declined renewal tells the team and ends `declined`; the customer and Accounting hear nothing", () => {
        expectDeclinedWiring(renewGraph, {
            step: "renew",
            check: "renew-declined",
            notice: "renew-notice",
            end: "declined",
            loop: null,
            title: titleOf("node.renew.title"),
        })
        const check = stepOf(renewGraph, "renew-declined")
        expect(check.kind === "if" ? check.routes.no : undefined).toBe("renewed-team")
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
