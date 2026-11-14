import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import type { GraphV2NodeStep, GraphV2Step } from "@nivo-lite/agent-sdk/graph"
import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import {
    type TemplateGraph,
    type TemplateTriggerLookup,
    templateAgentProblems,
    templateGraphProblems,
} from "@nivo-lite/agent-sdk/template"
import { CRM_NIVOWEB_PROVIDER } from "../../../crm/nivoweb/api.generated"
import { WEBSALES_PROVIDERS } from "../websales.accounts"
import { closeGraph } from "./close.graph"
import { enquiryGraph } from "./enquiry.graph"
import { linkGraph } from "./link.graph"
import { mailEnquiriesGraph } from "./mail-enquiries.graph"
import { roundGraph } from "./round.graph"
import { WEBSALES_TEAM_CHAT_KEY, teamChatGraph } from "./team-chat.graph"
import { websalesAgent } from "./websales.agent"
import { wonGraph } from "./won.graph"

/**
 * The engine's trigger lookup as this spec assumes it (ADDENDUM 1 B5): the clock supplies its preset, a team chat line supplies the
 * message itself, a workflow call supplies what the caller maps.
 */
const triggers: TemplateTriggerLookup = {
    supplies: (verb) => {
        if (verb === TRIGGER.workflowCalled) return { kind: "caller" }
        if (verb === TRIGGER.clockTick) return { kind: "fixed", params: [{ name: "preset", type: "string" }] }
        if (verb === TRIGGER.chatMessageReceived) return { kind: "fixed", params: [{ name: "text", type: "string" }] }
        // R53 (one-run enquiry): the talk's wait takes the person's next Zalo message: the generic members of a channel message on the
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


/** The step of a graph by key. */
const stepAt = (graph: TemplateGraph, key: string): GraphV2Step | undefined =>
    graph.spec.nodes.find((step) => step.key === key)

/** The Vietnamese title of a template node (the team's language of every Sales graph). */
const viTitleOf = (title: SpecText): string => ("vi" in title ? title.vi : title.key)

/**
 * True for a node step whose node can return `declined` (a person's decision on a step set to `ask`: NIVO Web's own steps run `auto`, but
 * a shop may set `ask` on its own copy of a step, `nivo-frame.rights`), so every such step keeps its declined wiring. The node says it can
 * by an example that scripts the decline.
 */
const asks = (graph: TemplateGraph, step: GraphV2Step): boolean =>
    step.kind === "node" &&
    (graph.nodes.get(step.step)?.examples ?? []).some((example) => JSON.stringify(example.output ?? null).includes('"declined":true'))

/**
 * The nodes whose one write IS the team's own post (the chat turn's reply): a person who declines it is the team, so its declined branch
 * goes straight to the outcome `declined`, with no team notice (EF-G 2026-11-14, rights 11c).
 */
const TEAM_POST_NODES: ReadonlySet<string> = new Set(["team.answer-post"])

/** The node steps of a graph that can be declined and block the run (no `blocking: false`), the team's own post aside. */
const blockingAskSteps = (graph: TemplateGraph): ReadonlyArray<GraphV2NodeStep> =>
    graph.spec.nodes.filter(
        (step): step is GraphV2NodeStep =>
            step.kind === "node" && asks(graph, step) && step.blocking !== false && !TEAM_POST_NODES.has(step.step),
    )

/**
 * The notice step a blocking asked step's declined branch goes to: its `declined` route, or the `yes` of the `ifNode` its `next` names
 * when that `ifNode` checks exactly `steps.<step>.output.declined` equal to true. Undefined when the step has no declined wiring.
 */
const declinedNoticeOf = (graph: TemplateGraph, step: GraphV2NodeStep): string | undefined => {
    if (step.routes !== undefined) return step.routes["declined"]
    const check = step.next === undefined ? undefined : stepAt(graph, step.next)
    if (check?.kind !== "if") return undefined
    const when = check.params.when
    const exact =
        "op" in when &&
        when.op === "eq" &&
        when.ref.$ref === `steps.${step.key}.output.declined` &&
        "value" in when &&
        when.value === true
    return exact ? check.routes.yes : undefined
}

describe("the Sales agent template", () => {
    it("loads with no problem, its graphs judged with its providers and the triggers' supplies", () => {
        expect(templateAgentProblems(websalesAgent, { triggers })).toEqual([])
        for (const graph of websalesAgent.graphs) {
            expect(
                templateGraphProblems(graph.spec, {
                    nodes: graph.nodes,
                    agentAccounts: websalesAgent.accounts,
                    triggers,
                }),
            ).toEqual([])
        }
    })

    it.each(websalesAgent.graphs.map((graph) => [graph.key, graph] as const))(
        "%s holds under the strict ref nullability",
        (_key, graph) => {
            expect(templateGraphProblems(graph.spec, { nodes: graph.nodes, nullability: "strict" })).toEqual([])
        },
    )

    it("attaches the CRM, the messaging accounts and the sending mailbox; the round is primary", () => {
        expect(websalesAgent.key).toBe("websales")
        expect(websalesAgent.accounts).toEqual(WEBSALES_PROVIDERS)
        expect(WEBSALES_PROVIDERS).toEqual([
            CRM_NIVOWEB_PROVIDER,
            PROVIDER.zaloOa,
            PROVIDER.telegram,
            PROVIDER.meta,
            PROVIDER.smtp,
        ])
        expect(websalesAgent.graphs.map((graph) => graph.key)).toEqual([
            "websales.round",
            "websales.enquiry",
            "websales.close",
            "websales.link",
            "websales.mail-enquiries",
            "websales.won",
            WEBSALES_TEAM_CHAT_KEY,
        ])
        expect(websalesAgent.primary).toBe("websales.round")
    })

    it.each(websalesAgent.graphs.map((graph) => [graph.key, graph] as const))(
        "%s carries its catalogue entry: the version it ships (every graph but the chat turn went up once more when NIVO Web went `auto`)",
        (key, graph) => {
            // ledger 2026-11-13 (`nivo-frame.rights`): every graph's catalogue version + 1 (one mode per node changed every compiled document),
            // then + 1 again but the chat turn (D-5: the sends, the close and the reminders run `auto`, the wording no longer promises an approval).
            const versions: Readonly<Record<string, number>> = {
                // 2026-11-14 (EF-G): the chat turn + 1 (a declined answer post ends the turn `declined`).
                // 2026-11-14 (one event pipeline): the versions shipped once every graph reads the generic trigger scope and each called
                // graph takes its caller's params in `trigger.data`.
                // 2026-11-14 04:50 (design moved): every called graph + 1, its trigger carries no `burst` (settle is the declaration's).
                [WEBSALES_TEAM_CHAT_KEY]: 6,
                "websales.close": 8,
                "websales.link": 7,
                "websales.round": 5,
                // 2026-11-14 (R53, the conversation as one run): the enquiry is a talk loop, version 8.
                "websales.enquiry": 8,
                "websales.mail-enquiries": 6,
                "websales.won": 7,
            }
            expect(graph.spec.catalogue?.version).toBe(versions[key])
            expect(graph.spec.catalogue?.publishedAt).toBe(
                key === "websales.round"
                    ? "2026-11-14T03:00:00.000Z"
                    : key === WEBSALES_TEAM_CHAT_KEY
                      ? "2026-11-14T04:15:00.000Z"
                      : key === "websales.enquiry"
                        ? "2026-11-14T16:00:00.000Z"
                        : "2026-11-14T04:50:00.000Z",
            )
        },
    )
})

describe("websales.round", () => {
    it("is woken on working days at 08:30 and open to the agent", () => {
        expect(roundGraph.spec.triggers).toEqual([
            { verb: TRIGGER.clockTick, args: { preset: "weekdays_at", at: "08:30" } },
        ])
        expect(roundGraph.spec.entry.openTo).toBe("agent")
    })

    it("finds the due quotes, then per purchase sends, records only what was sent, then reports", () => {
        expect(stepsOf(roundGraph)).toEqual([
            ["due", "websales.due"],
            ["each", "loop"],
            ["follow", "websales.follow-send"],
            ["follow-declined", "if"],
            ["follow-notice", "team.declined-notice"],
            ["sent", "if"],
            ["record", "websales.follow-record"],
            ["record-declined", "if"],
            ["record-notice", "team.declined-notice"],
            ["report", "websales.round-report"],
            ["followed", "outcome"],
        ])
    })
})

describe("websales.enquiry", () => {
    it("is called by the Support front door", () => {
        expect(enquiryGraph.spec.triggers).toEqual([{ verb: TRIGGER.workflowCalled }])
        expect(enquiryGraph.spec.entry.openTo).toBe("any")
    })

    // R53 (the conversation as one run): v7's steps, in v7's order, inside the talk loop (`talk`), each round first taking the message
    // (round 1: the hand-off; later: `hear` -> the front door's own `desk` judgement -> `give-back` when not a new purchase ->
    // `message`); the ending routes (agree with a quote, paid, no) run after the talk, read from its `last` (`settled`, `*-said`).
    it("opens, notes and understands, then routes five ways", () => {
        expect(stepsOf(enquiryGraph)).toEqual([
            ["talk", "loop"],
            ["opening", "if"],
            ["hear", "wait"],
            ["desk", "webdesk.understand-sales"],
            ["give-back", "hand-back"],
            ["message", "websales.round-message"],
            ["open", "websales.purchase-open"],
            ["open-declined", "if"],
            ["open-notice", "team.declined-notice"],
            ["note", "websales.purchase-note"],
            ["understand", "websales.understand"],
            ["ask", "websales.ask"],
            ["ask-declined", "if"],
            ["ask-notice", "team.declined-notice"],
            ["quote", "websales.quote-create"],
            ["quote-declined", "if"],
            ["quote-notice", "team.declined-notice"],
            ["quote-send", "websales.quote-send"],
            ["quote-send-declined", "if"],
            ["quote-send-notice", "team.declined-notice"],
            ["has-quote", "if"],
            ["settled", "if"],
            ["declined-said", "if"],
            ["agree-said", "if"],
            ["paid-said", "if"],
            ["agreed-reply", "websales.heard-reply"],
            ["agreed-reply-declined", "if"],
            ["agreed-notify", "websales.heard-notify"],
            ["agreed", "outcome"],
            ["paid-reply", "websales.heard-reply"],
            ["paid-reply-declined", "if"],
            ["heard-notice", "team.declined-notice"],
            ["paid-notify", "websales.heard-notify"],
            ["lose", "websales.purchase-lose"],
            ["lose-declined", "if"],
            ["lose-notice", "team.declined-notice"],
            ["lost-notify", "websales.lost-notify"],
            ["lost-end", "outcome"],
            ["declined", "outcome"],
            ["quiet", "outcome"],
        ])
    })
})

describe("websales.close and websales.link", () => {
    it("both are called by the agent's own chat turn only: no chat-line trigger of their own", () => {
        expect(closeGraph.spec.triggers).toEqual([{ verb: TRIGGER.workflowCalled }])
        expect(linkGraph.spec.triggers).toEqual([{ verb: TRIGGER.workflowCalled }])
        expect(closeGraph.spec.entry.openTo).toBe("agent")
        expect(linkGraph.spec.entry.openTo).toBe("agent")
    })

    it("close finds, settles the customer, accepts, tells how to pay, tells the team and hands the contract to Documents", () => {
        expect(stepsOf(closeGraph)).toEqual([
            ["find", "websales.close-find"],
            ["propose", "websales.customer-propose"],
            ["propose-declined", "if"],
            ["propose-notice", "team.declined-notice"],
            ["accept", "websales.accept"],
            ["accept-declined", "if"],
            ["accept-notice", "team.declined-notice"],
            ["pay", "websales.pay-instruct"],
            ["pay-declined", "if"],
            ["pay-notice", "team.declined-notice"],
            ["notify", "websales.close-notify"],
            ["to-draft", "call-workflow"],
            ["awaiting-payment", "outcome"],
            ["declined", "outcome"],
        ])
    })

    it("link finds, writes the link and tells the team on each route", () => {
        expect(stepsOf(linkGraph)).toEqual([
            ["find", "websales.link-find"],
            ["write", "websales.link-write"],
            ["tell-linked", "websales.link-notify"],
            ["linked", "outcome"],
            ["tell-none", "websales.link-notify"],
            ["unknown", "outcome"],
            ["write-notice", "team.declined-notice"],
            ["declined", "outcome"],
        ])
    })
})

describe("websales.mail-enquiries and websales.won", () => {
    it("mail-enquiries loops over at most 25 mails; the reply draft and the notice are side steps", () => {
        expect(mailEnquiriesGraph.spec.triggers).toEqual([{ verb: TRIGGER.workflowCalled }])
        expect(mailEnquiriesGraph.spec.nodes.find((step) => step.key === "each")).toMatchObject({ params: { max: 25 } })
        expect(stepsOf(mailEnquiriesGraph)).toEqual([
            ["each", "loop"],
            ["open", "websales.mail-purchase-open"],
            ["open-declined", "if"],
            ["open-notice", "team.declined-notice"],
            ["understand", "websales.mail-understand"],
            ["quote", "websales.quote-create"],
            ["quote-declined", "if"],
            ["quote-notice", "team.declined-notice"],
            ["draft", "websales.mail-reply-draft"],
            ["notify", "websales.mail-notify"],
            ["recorded", "outcome"],
        ])
    })

    it("won hands the work over first, then tells the customer in a side step", () => {
        expect(wonGraph.spec.triggers).toEqual([{ verb: TRIGGER.workflowCalled }])
        expect(stepsOf(wonGraph)).toEqual([
            ["handover", "websales.handover-notify"],
            ["tell", "websales.paid-tell"],
            ["won", "outcome"],
        ])
    })
})

describe("websales.team-chat", () => {
    it("routes first, then answers with blocks-core's chat turn step for step, or hands on to the close or the link", () => {
        expect(teamChatGraph.spec.triggers).toEqual([{ verb: TRIGGER.workflowCalled }])
        expect(stepsOf(teamChatGraph)).toEqual([
            ["route", "websales.team-route"],
            ["answer", "websales.team-answer"],
            ["has-proposal", "if"],
            ["propose", "team.truth-propose"],
            ["post", "team.answer-post"],
            ["post-declined", "if"],
            ["declined", "outcome"],
            ["to-close", "call-workflow"],
            ["handed-close", "outcome"],
            ["to-link", "call-workflow"],
            ["handed-link", "outcome"],
        ])
    })

    it("has the three routes of the request", () => {
        expect(stepAt(teamChatGraph, "route")).toMatchObject({
            routeBy: "route",
            routes: { answer: "answer", close: "to-close", link: "to-link" },
        })
    })

    it("hands the request the route wrote to the close and to the link, the agent's own graphs", () => {
        for (const [key, workflow, end] of [
            ["to-close", "close", "handed-close"],
            ["to-link", "link", "handed-link"],
        ] as const) {
            expect(stepAt(teamChatGraph, key)).toMatchObject({
                kind: "call-workflow",
                params: { agent: "websales", workflow, inputs: { text: { $ref: "steps.route.output.request" } } },
                next: end,
            })
            expect(websalesAgent.graphs.map((graph) => graph.key)).toContain(`websales.${workflow}`)
        }
    })

    it("is the agent's ONE graph on its team-chat entry: no two graphs share a trigger verb but the workflow call", () => {
        const verbs = websalesAgent.graphs.flatMap((graph) =>
            graph.spec.triggers.map((one) => one.verb).filter((verb) => verb !== TRIGGER.workflowCalled),
        )
        expect(new Set(verbs).size).toBe(verbs.length)
        expect(verbs).not.toContain(TRIGGER.chatMessageReceived)
    })
})

describe("a declined approval (the owner's rule: a decision, never a failure)", () => {
    it.each(websalesAgent.graphs.map((graph) => [graph.key, graph] as const))(
        "%s routes every blocking asked step's decline to its team notice, then to the outcome declined (or the item's end in a loop)",
        (_key, graph) => {
            for (const step of blockingAskSteps(graph)) {
                const noticeKey = declinedNoticeOf(graph, step)
                expect([step.key, noticeKey === undefined ? "no declined wiring" : "wired"]).toEqual([
                    step.key,
                    "wired",
                ])
                const notice = noticeKey === undefined ? undefined : stepAt(graph, noticeKey)
                const declinedNode = graph.nodes.get(step.step)
                expect(notice).toMatchObject({
                    kind: "node",
                    step: "team.declined-notice",
                    params: {
                        step: declinedNode === undefined ? "no node" : viTitleOf(declinedNode.title),
                        locale: "vi",
                    },
                })
                expect(notice !== undefined && "ref" in notice.params).toBe(true)
                // R53: a step inside the enquiry's TALK (an `until` loop) stops the whole conversation, as it stopped the run in v7:
                // its notice is the run's and ends the round, the talk then ends at `declined`; only an `over` loop's item ends alone.
                const owner = step.loop === undefined ? undefined : stepAt(graph, step.loop)
                const inTalk = owner?.kind === "loop" && owner.params.mode === "until"
                expect(notice).toMatchObject({ params: { scope: step.loop === undefined || inTalk ? "run" : "item" } })
                // (a body step whose next is `endRound` stores no `next`: the round ends there)
                if (inTalk) expect(notice?.kind === "node" ? notice.next : "not a node").toBeUndefined()
                else if (step.loop === undefined) {
                    expect(notice).toMatchObject({ next: "declined" })
                    expect(stepAt(graph, "declined")).toMatchObject({
                        kind: "outcome",
                        params: { outcome: "declined" },
                    })
                } else expect(notice?.kind === "node" ? notice.next : "not a node").toBeUndefined()
            }
        },
    )

    it("covers the blocking asked steps the module has: none is left without the declined wiring", () => {
        expect(
            websalesAgent.graphs.flatMap((graph) => blockingAskSteps(graph).map((step) => `${graph.key}:${step.key}`)),
            // ledger 2026-11-13 (`nivo-frame.rights`, "nivo-web la auto gan het"; D-5): every step of the module runs `auto`, but each node that can
            // return `declined` (the sends, the CRM records, the close writes) keeps its wiring for a shop that sets `ask` on its own copy.
        ).toEqual([
            "websales.round:follow",
            "websales.round:record",
            "websales.enquiry:open",
            "websales.enquiry:ask",
            "websales.enquiry:quote",
            "websales.enquiry:quote-send",
            "websales.enquiry:agreed-reply",
            "websales.enquiry:paid-reply",
            "websales.enquiry:lose",
            "websales.close:propose",
            "websales.close:accept",
            "websales.close:pay",
            "websales.mail-enquiries:open",
            "websales.mail-enquiries:quote",
        ])
    })

    it("routes a declined reply of the chat turn (the team's own post) straight to the outcome declined, with no notice", () => {
        expect(stepAt(teamChatGraph, "post")).toMatchObject({ step: "team.answer-post", next: "post-declined" })
        expect(stepAt(teamChatGraph, "post-declined")).toMatchObject({
            kind: "if",
            params: { when: { op: "eq", ref: { $ref: "steps.post.output.declined" }, value: true } },
            routes: { yes: "declined" },
        })
        expect(stepAt(teamChatGraph, "declined")).toMatchObject({ kind: "outcome", params: { outcome: "declined" } })
    })

    it("keeps the side steps that can be declined (the purchase note) without a notice: they report and the run goes on", () => {
        const side = websalesAgent.graphs.flatMap((graph) =>
            graph.spec.nodes
                .filter((step) => asks(graph, step) && step.kind === "node" && step.blocking === false)
                .map((step) => `${graph.key}:${step.key}`),
        )
        // ledger 2026-11-13 (`nivo-frame.rights`; D-5): the mailed reply and the paid line run `auto` and return no `declined`.
        expect(side).toEqual(["websales.enquiry:note"])
    })

    it("a declined item inside a loop gets the item's notice line; every other notice is the run's", () => {
        const scopes = websalesAgent.graphs.flatMap((graph) =>
            graph.spec.nodes
                .filter((step) => step.kind === "node" && step.step === "team.declined-notice")
                .map((step) => [`${graph.key}:${step.key}`, step.kind === "node" ? step.params["scope"] : null]),
        )
        expect(scopes.filter(([, scope]) => scope === "item").map(([key]) => key)).toEqual([
            "websales.round:follow-notice",
            "websales.round:record-notice",
            "websales.mail-enquiries:open-notice",
            "websales.mail-enquiries:quote-notice",
        ])
        expect(scopes.every(([, scope]) => scope === "item" || scope === "run")).toBe(true)
    })

    it("the two heard replies share one notice: the same step about the same purchase", () => {
        expect(stepAt(enquiryGraph, "agreed-reply-declined")).toMatchObject({ routes: { yes: "heard-notice" } })
        expect(stepAt(enquiryGraph, "paid-reply-declined")).toMatchObject({ routes: { yes: "heard-notice" } })
        // R53: the heard replies run after the talk, so the purchase is the one the ending round's understand step answered (`last`,
        // the purchase code it passes on from `open`): the same purchase v7 read from `steps.open`.
        expect(stepAt(enquiryGraph, "heard-notice")).toMatchObject({
            params: { ref: { $ref: "steps.talk.output.last.purchaseCode" } },
        })
    })
})

describe("the websales catalogues' seedActive", () => {
    it("mirrors the old JSON template of every graph: active at seed exactly where the JSON said `seedActive: true`", () => {
        const seeded = websalesAgent.graphs.map(
            (graph) => [graph.key, graph.spec.catalogue?.seedActive === true] as const,
        )
        expect([...seeded].sort(([a], [b]) => a.localeCompare(b))).toEqual([
            ["websales.close", true],
            ["websales.enquiry", true],
            ["websales.link", true],
            ["websales.mail-enquiries", true],
            ["websales.round", false],
            ["websales.team-chat", true],
            ["websales.won", true],
        ])
    })
})
