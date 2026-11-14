import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateGraph,
    type TemplateTriggerLookup,
    templateAgentProblems,
    templateGraphProblems,
} from "@nivo-lite/agent-sdk/template"
import { CRM_NIVOWEB_PROVIDER } from "../../../crm/nivoweb/api.generated"
import { WEBDESK_PROVIDERS } from "../../../nodes/webdesk/webdesk.accounts"
import { webdeskFrontGraph } from "./front.graph"
import { webdeskMailTicketsGraph } from "./mail-tickets.graph"
import { webdeskTeamChatGraph } from "./team-chat.graph"
import { webdeskTicketGraph } from "./ticket.graph"
import { webdeskAgent } from "./webdesk.agent"

/** The engine's trigger lookup as this spec assumes it (ruling B5): a message supplies the message, a call what it maps. */
const triggers: TemplateTriggerLookup = {
    supplies: (verb) => {
        if (verb === TRIGGER.workflowCalled) return { kind: "caller" }
        if (verb === TRIGGER.zaloMessageReceived) {
            return {
                kind: "fixed",
                // The generic members of a channel message on the one event pipeline (2026-11-14).
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

/** One step of a graph by key. */
const stepOf = (graph: TemplateGraph, key: string): (typeof graph.spec.nodes)[number] | undefined =>
    graph.spec.nodes.find((step) => step.key === key)

/**
 * The declined wiring of a blocking `ask` step (DECLINED rule 2), as stored: the step goes to an `if` on its own `declined` member; the
 * yes branch is ONE `team.declined-notice` step naming the step's vi title (and the record), which goes on to `end` (the outcome
 * `declined`; absent inside a loop body: the item ends there); the no branch is the rest of the graph.
 */
const declinedWiringOf = (graph: TemplateGraph, key: string, check: string, notice: string) => {
    const step = stepOf(graph, key)
    const branch = stepOf(graph, check)
    const told = stepOf(graph, notice)
    return {
        next: step?.kind === "node" ? step.next : null,
        when: branch?.kind === "if" ? branch.params.when : null,
        yes: branch?.kind === "if" ? branch.routes.yes : null,
        notice:
            told?.kind === "node"
                ? [told.step, told.params["step"], told.params["ref"], told.params["scope"] ?? "run", told.next ?? null]
                : null,
    }
}

describe("the Support agent template", () => {
    it("loads with no problem, its graphs judged with its providers and the supplies of its triggers", () => {
        expect(templateAgentProblems(webdeskAgent, { triggers })).toEqual([])
        for (const graph of webdeskAgent.graphs) {
            expect(
                templateGraphProblems(graph.spec, {
                    nodes: graph.nodes,
                    agentAccounts: webdeskAgent.accounts,
                    triggers,
                    nullability: "strict",
                }),
            ).toEqual([])
        }
    })

    it("attaches the CRM, the messaging accounts and the mail account; the front door is primary", () => {
        expect(webdeskAgent.key).toBe("webdesk")
        expect(webdeskAgent.accounts).toEqual(WEBDESK_PROVIDERS)
        expect(WEBDESK_PROVIDERS).toEqual([
            CRM_NIVOWEB_PROVIDER,
            PROVIDER.zaloOa,
            PROVIDER.telegram,
            PROVIDER.meta,
            PROVIDER.smtp,
        ])
        expect(webdeskAgent.graphs.map((graph) => graph.key)).toEqual([
            "webdesk.front",
            "webdesk.ticket",
            "webdesk.mail-tickets",
            "webdesk.team-chat",
        ])
        expect(webdeskAgent.primary).toBe("webdesk.front")
        expect(
            [webdeskFrontGraph, webdeskTicketGraph, webdeskMailTicketsGraph].map((graph) => [
                graph.key,
                graph.spec.catalogue?.version,
            ]),
            // ledger 2026-11-13 (`nivo-frame.rights`): every graph's catalogue version + 1 (one mode per node changed every compiled document); 2026-11-13 later: + 1 again (NIVO Web `auto` almost everywhere).
        ).toEqual([
            ["webdesk.front", 12],
            ["webdesk.ticket", 11],
            ["webdesk.mail-tickets", 8],
        ])
        // Ledger 2026-11-14 (R4 rulings, each graph's own catalogue `notes` say why): front 8 -> 12 (no `burst`, call params under `data`, the hand-offs
        // end the front desk's run, ...), ticket 9 -> 11, mail-tickets 7 -> 8; the versions are the graphs' own, this spec only records them.
        // 2026-11-14 (EF-G, `rights` 11c): the chat turn + 1 (a declined answer post ends the turn `declined`).
        expect(webdeskTeamChatGraph.spec.catalogue?.version).toBe(5)
    })
})

describe("webdesk.front", () => {
    it("wakes on a Zalo message (the channel's own verb), open to any caller", () => {
        expect(webdeskFrontGraph.key).toBe("webdesk.front")
        // Ledger (owner key triggerOneSource2026_11_12, CORRECTED 2026-11-12): `account: x` -> `accounts: [x]` (mechanical SDK migration).
        expect(webdeskFrontGraph.spec.triggers).toEqual([
            {
                verb: TRIGGER.zaloMessageReceived,
                accounts: [PROVIDER.zaloOa],
            },
        ])
        // Design moved (front v12): no `burst` on the trigger; how a burst settles is the trigger declaration's `settle`.
        expect(webdeskFrontGraph.spec.entry.openTo).toBe("any")
    })

    it("understands, then hands a fault, a renewal and a sale on, answers a complaint and a question itself", () => {
        expect(stepsOf(webdeskFrontGraph)).toEqual(
            expect.arrayContaining([
                ["understand", "webdesk.understand-sales"],
                ["to-ticket", "call-workflow"],
                ["to-renewal", "call-workflow"],
                ["to-sales", "call-workflow"],
                ["complaint-reply", "chatbot.complaint-reply"],
                ["complaint-notify", "chatbot.complaint-notify"],
                ["to-person", "outcome"],
                ["answer", "chatbot.answer"],
                ["complaint-declined", "if"],
                ["complaint-notice", "team.declined-notice"],
                ["answer-declined", "if"],
                ["answer-notice", "team.declined-notice"],
                ["declined", "outcome"],
            ]),
        )
        expect(webdeskFrontGraph.spec.nodes).toHaveLength(13)
        const handOffs = ["to-ticket", "to-renewal", "to-sales"].map((key) => {
            const step = stepOf(webdeskFrontGraph, key)
            return step?.kind === "call-workflow" ? [step.params.agent, step.params.workflow] : null
        })
        expect(handOffs).toEqual([
            ["webdesk", "ticket"],
            ["webrenew", "answer"],
            ["websales", "enquiry"],
        ])
    })

    it("lets the Chatbot customer sends run on their own", () => {
        for (const key of ["complaint-reply", "answer"]) {
            const step = stepOf(webdeskFrontGraph, key)
            // The workflow sets the step's one mode (`nivo-frame.rights`); the send goes through the messaging providers, in order.
            expect(step?.kind === "node" ? { mode: step.mode, accounts: step.accounts } : null).toEqual({
                mode: "auto",
                accounts: [PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.meta],
            })
        }
    })
})

describe("webdesk.front, declined", () => {
    it("routes a person's no to either customer send of the Chatbot steps to one team notice, then the outcome declined", () => {
        expect(
            declinedWiringOf(webdeskFrontGraph, "complaint-reply", "complaint-declined", "complaint-notice"),
        ).toEqual({
            next: "complaint-declined",
            when: { op: "eq", ref: { $ref: "steps.complaint-reply.output.declined", default: null }, value: true },
            yes: "complaint-notice",
            notice: [
                "team.declined-notice",
                "Tr\u1ea3 l\u1eddi khi\u1ebfu n\u1ea1i",
                { $ref: "steps.complaint-reply.output.orderCode" },
                "run",
                "declined",
            ],
        })
        expect(declinedWiringOf(webdeskFrontGraph, "answer", "answer-declined", "answer-notice")).toEqual({
            next: "answer-declined",
            when: { op: "eq", ref: { $ref: "steps.answer.output.declined", default: null }, value: true },
            yes: "answer-notice",
            notice: ["team.declined-notice", "Tr\u1ea3 l\u1eddi c\u00e2u h\u1ecfi", null, "run", "declined"],
        })
        const complaint = stepOf(webdeskFrontGraph, "complaint-declined")
        const answer = stepOf(webdeskFrontGraph, "answer-declined")
        expect([
            complaint?.kind === "if" ? complaint.routes.no : null,
            answer?.kind === "if" ? (answer.routes.no ?? null) : null,
        ]).toEqual(["complaint-notify", null])
        expect(webdeskFrontGraph.spec.outcomes.map((outcome) => outcome.key).sort()).toEqual(["declined", "person"])
    })
})

describe("webdesk.ticket", () => {
    it("is called by the agent only", () => {
        expect(webdeskTicketGraph.spec.triggers).toEqual([{ verb: TRIGGER.workflowCalled }])
        expect(webdeskTicketGraph.spec.entry.openTo).toBe("agent")
    })

    it("opens, checks, plans, tells the team, answers, notes, asks for the link when unlinked, and ends in three outcomes", () => {
        expect(stepsOf(webdeskTicketGraph)).toEqual(
            expect.arrayContaining([
                ["intake", "webdesk.intake-linked"],
                ["check", "webdesk.check"],
                ["answer-plan", "webdesk.answer-plan"],
                ["team-tell", "webdesk.team-tell"],
                ["team-tell-declined", "if"],
                ["has-reply", "if"],
                ["customer-reply", "webdesk.customer-reply"],
                ["ticket-note", "webdesk.ticket-note"],
                ["is-unlinked", "if"],
                ["link-ask", "webdesk.team-tell"],
                ["link-ask-declined", "if"],
                ["is-covered", "if"],
                ["in-progress", "outcome"],
                ["quoted", "outcome"],
                ["intake-declined", "if"],
                ["intake-notice", "team.declined-notice"],
                ["reply-declined", "if"],
                ["reply-notice", "team.declined-notice"],
                ["note-declined", "if"],
                ["note-notice", "team.declined-notice"],
                ["declined", "outcome"],
            ]),
        )
        expect(webdeskTicketGraph.spec.nodes).toHaveLength(21)
        expect(webdeskTicketGraph.spec.outcomes.map((outcome) => outcome.key).sort()).toEqual([
            "declined",
            "in-progress",
            "quoted",
        ])
    })

    it("routes a person's no to each blocking ask write (ticket, reply, note) to one team notice, then the outcome declined", () => {
        const wiring = [
            ["intake", "intake-declined", "intake-notice", "check", "M\u1edf phi\u1ebfu", null],
            [
                "customer-reply",
                "reply-declined",
                "reply-notice",
                "ticket-note",
                "Tr\u1ea3 l\u1eddi kh\u00e1ch",
                { $ref: "steps.intake.output.ticketId" },
            ],
            [
                "ticket-note",
                "note-declined",
                "note-notice",
                "is-unlinked",
                "Ghi phi\u1ebfu",
                { $ref: "steps.intake.output.ticketId" },
            ],
        ] as const
        for (const [key, check, notice, rest, title, record] of wiring) {
            expect(declinedWiringOf(webdeskTicketGraph, key, check, notice)).toEqual({
                next: check,
                when: { op: "eq", ref: { $ref: `steps.${key}.output.declined`, default: null }, value: true },
                yes: notice,
                notice: ["team.declined-notice", title, record, "run", "declined"],
            })
            const branch = stepOf(webdeskTicketGraph, check)
            expect(branch?.kind === "if" ? branch.routes.no : null).toBe(rest)
        }
        const declined = stepOf(webdeskTicketGraph, "declined")
        expect(declined?.kind === "outcome" ? declined.params : null).toEqual({
            outcome: "declined",
            outputs: { ticketId: { $ref: "steps.intake.output.ticketId" } },
        })
    })

    it("routes a person's no to a team post (the plan, the link line) straight to the outcome declined, with no notice", () => {
        for (const [key, check, rest] of [
            ["team-tell", "team-tell-declined", "has-reply"],
            ["link-ask", "link-ask-declined", "is-covered"],
        ] as const) {
            const step = stepOf(webdeskTicketGraph, key)
            expect(step?.kind === "node" ? step.next : null).toBe(check)
            const branch = stepOf(webdeskTicketGraph, check)
            expect(branch?.kind === "if" ? branch.params.when : null).toEqual({
                op: "eq",
                ref: { $ref: `steps.${key}.output.declined`, default: null },
                value: true,
            })
            expect(branch?.kind === "if" ? [branch.routes.yes, branch.routes.no] : null).toEqual(["declined", rest])
        }
    })
})

describe("webdesk.mail-tickets", () => {
    it("is open to any caller (the Mailbox hands its tickets on)", () => {
        expect(webdeskMailTicketsGraph.spec.triggers).toEqual([{ verb: TRIGGER.workflowCalled }])
        expect(webdeskMailTicketsGraph.spec.entry.openTo).toBe("any")
    })

    it("runs one loop per mail, keyed by the mail: identify, link, open, check, plan, tell, draft, note", () => {
        expect(stepsOf(webdeskMailTicketsGraph)).toEqual(
            expect.arrayContaining([
                ["each", "loop"],
                ["identify", "webdesk.identify"],
                ["has-link", "if"],
                ["contact-link", "webdesk.contact-link"],
                ["ticket-open", "webdesk.ticket-open"],
                ["check", "webdesk.check"],
                ["plan", "webdesk.plan"],
                ["team-tell", "webdesk.team-tell"],
                ["team-tell-declined", "if"],
                ["has-reply", "if"],
                ["mail-reply-draft", "webdesk.mail-reply-draft"],
                ["ticket-note", "webdesk.ticket-note"],
                ["open-declined", "if"],
                ["open-notice", "team.declined-notice"],
                ["note-declined", "if"],
                ["note-notice", "team.declined-notice"],
                ["opened", "outcome"],
            ]),
        )
        expect(webdeskMailTicketsGraph.spec.nodes).toHaveLength(17)
        const loop = stepOf(webdeskMailTicketsGraph, "each")
        expect(
            loop?.kind === "loop" && loop.params.mode === "over"
                ? [loop.params.itemKey, loop.params.collect, loop.params.max, loop.params.concurrency]
                : null,
        ).toEqual(["mailId", "ticket-note", 25, 1])
    })

    it("ends a mail's item after one team notice when a person declines its ticket or its note; the round goes on", () => {
        expect(declinedWiringOf(webdeskMailTicketsGraph, "ticket-open", "open-declined", "open-notice")).toEqual({
            next: "open-declined",
            when: { op: "eq", ref: { $ref: "steps.ticket-open.output.declined", default: null }, value: true },
            yes: "open-notice",
            notice: ["team.declined-notice", "M\u1edf phi\u1ebfu", { $ref: "item.mailId" }, "item", null],
        })
        expect(declinedWiringOf(webdeskMailTicketsGraph, "ticket-note", "note-declined", "note-notice")).toEqual({
            next: "note-declined",
            when: { op: "eq", ref: { $ref: "steps.ticket-note.output.declined", default: null }, value: true },
            yes: "note-notice",
            notice: ["team.declined-notice", "Ghi phi\u1ebfu", { $ref: "steps.ticket-note.output.ticketId" }, "item", null],
        })
        const opened = stepOf(webdeskMailTicketsGraph, "open-declined")
        const noted = stepOf(webdeskMailTicketsGraph, "note-declined")
        expect([
            opened?.kind === "if" ? opened.routes.no : null,
            noted?.kind === "if" ? (noted.routes.no ?? null) : null,
        ]).toEqual(["check", null])
        // A declined team post (the plan) ends its item with no notice (the post was the team's own); the items are independent.
        const told = stepOf(webdeskMailTicketsGraph, "team-tell")
        expect(told?.kind === "node" ? told.next : null).toBe("team-tell-declined")
        const toldCheck = stepOf(webdeskMailTicketsGraph, "team-tell-declined")
        expect(toldCheck?.kind === "if" ? toldCheck.params.when : null).toEqual({
            op: "eq",
            ref: { $ref: "steps.team-tell.output.declined", default: null },
            value: true,
        })
        expect(toldCheck?.kind === "if" ? [toldCheck.routes.yes ?? null, toldCheck.routes.no] : null).toEqual([
            null,
            "has-reply",
        ])
        // No `declined` outcome inside a loop: the round's outcome hands every item's collected note on (null = ticket declined).
        expect(webdeskMailTicketsGraph.spec.outcomes.map((outcome) => outcome.key)).toEqual(["opened"])
        const outcome = stepOf(webdeskMailTicketsGraph, "opened")
        expect(outcome?.kind === "outcome" ? outcome.params : null).toEqual({
            outcome: "opened",
            outputs: { tickets: { $ref: "steps.each.output.items" } },
        })
    })
})

describe("webdesk.team-chat", () => {
    it("is the shared chat turn with the Support agent's answer turn", () => {
        expect(webdeskTeamChatGraph.key).toBe("webdesk.team-chat")
        expect(webdeskTeamChatGraph.spec.triggers).toEqual([{ verb: TRIGGER.workflowCalled }])
        expect(stepsOf(webdeskTeamChatGraph)).toEqual(
            expect.arrayContaining([
                ["answer", "webdesk.team-answer"],
                ["has-proposal", "if"],
                ["propose", "team.truth-propose"],
                ["post", "team.answer-post"],
                ["post-declined", "if"],
                ["declined", "outcome"],
            ]),
        )
    })
})

describe("the webdesk catalogues' seedActive", () => {
    it("mirrors the old JSON template of every graph: active at seed exactly where the JSON said `seedActive: true`", () => {
        const seeded = webdeskAgent.graphs.map(
            (graph) => [graph.key, graph.spec.catalogue?.seedActive === true] as const,
        )
        expect([...seeded].sort(([a], [b]) => a.localeCompare(b))).toEqual([
            ["webdesk.front", false],
            ["webdesk.mail-tickets", true],
            ["webdesk.team-chat", true],
            ["webdesk.ticket", true],
        ])
    })
})
