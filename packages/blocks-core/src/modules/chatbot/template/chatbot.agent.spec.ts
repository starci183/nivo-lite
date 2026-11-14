import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import { templateGraphProblems } from "@nivo-lite/agent-sdk/template"
import { chatbotAgent } from "./chatbot.agent"
import { FRONT_DESK_GRAPH_KEY, frontDeskGraph } from "./front-desk.graph"

/** Importing the agent builds it: the builders throw `TemplateDefinitionError` at load with every problem, so reaching here is clean. */
describe("chatbot agent template", () => {
    it("holds the front desk (primary) and its team chat, on the messaging accounts", () => {
        expect(chatbotAgent.key).toBe("chatbot")
        expect(chatbotAgent.primary).toBe(FRONT_DESK_GRAPH_KEY)
        expect(chatbotAgent.accounts).toEqual(["zalo_oa", "telegram", "meta"])
        expect(chatbotAgent.graphs.map((graph) => graph.key)).toEqual(["chatbot.front-desk", "chatbot.team-chat"])
    })

    it("every graph's refs fit with nullability strict: a ref that may read nothing lands on an input that takes null", () => {
        for (const graph of chatbotAgent.graphs) {
            expect(templateGraphProblems(graph.spec, { nodes: graph.nodes, nullability: "strict" })).toEqual([])
        }
    })

    it("front desk version 25: one message trigger per channel (Zalo OA, Telegram, Facebook, Instagram); no burst (settle is the declaration's)", () => {
        // Version 25 (design moved, R45): no `fresh-visit` end (a /start with no words goes on and the model greets); the sale gets the
        // visit's start (`since`) and reads the engine's thread; the money-in hand-off's unread `recentLines` is gone.
        // Version 24 (design moved, R43): hear has no `held` end and the outcome `held` is gone (a staff hold is the engine's send door's).
        // Version 23 (design moved, R26): hear stores no line and hands the chat window `startedAt` on; v22 dropped the triggers' `burst`.
        // Version 15: the hand-off to the Booking carries the recent lines. Version 14: the hand-off to the Booking carries the person as `contactId`. Version 13: the Sales hand-offs carry the recent lines. Version 12: the hand-offs to Sales carry the contact. Version 11: Meta's two channels join. Version 10: `paid` hands to the Sales money-in graph (the Accounting reconcile is gone).
        expect(frontDeskGraph.spec.catalogue?.version).toBe(25)
        expect(frontDeskGraph.spec.catalogue?.name).toEqual({ vi: "Lễ tân", en: "Front desk" })
        expect(frontDeskGraph.spec.moduleKey).toBe("chatbot")
        // Ledger (owner key triggerOneSource2026_11_12, CORRECTED 2026-11-12): `account: x` -> `accounts: [x]` (mechanical SDK migration).
        expect(frontDeskGraph.spec.triggers).toEqual([
            {
                verb: TRIGGER.zaloMessageReceived,
                accounts: ["zalo_oa"],
            },
            {
                verb: TRIGGER.telegramMessageReceived,
                accounts: ["telegram"],
            },
            {
                verb: TRIGGER.facebookMessageReceived,
                accounts: ["meta"],
            },
            {
                verb: TRIGGER.instagramMessageReceived,
                accounts: ["meta"],
            },
        ])
    })

    it("front desk steps: understand routes five ways; complaint reply then the side notice then the owner", () => {
        const steps = frontDeskGraph.spec.nodes
        expect(steps.map((step) => step.key).toSorted()).toEqual(
            [
                "answer",
                "answer-declined",
                "answer-declined-notice",
                "complaint-declined",
                "complaint-declined-notice",
                "complaint-notify",
                "complaint-reply",
                "declined",
                "hear",
                "nothing-to-answer",
                "to-booking",
                "to-consult",
                "to-owner",
                "to-payment",
                "understand",
            ].toSorted(),
        )
        // The first step is the hear step (the chatbot's own records; R43: no holder end, the hold is the engine's; R45: a /start goes on).
        expect(frontDeskGraph.spec.nodes[0]?.key).toBe("hear")
        expect(steps.find((step) => step.key === "hear")).toMatchObject({
            kind: "node",
            step: "chatbot.hear",
            routes: { go: "understand", nothing: "nothing-to-answer" },
        })
        const understand = steps.find((step) => step.key === "understand")
        expect(understand).toMatchObject({
            kind: "node",
            step: "chatbot.understand",
            routes: { buy: "to-consult", book: "to-booking", paid: "to-payment", complaint: "complaint-reply", question: "answer" },
        })
        expect(steps.find((step) => step.key === "complaint-reply")).toMatchObject({ next: "complaint-declined" })
        expect(steps.find((step) => step.key === "complaint-declined")).toMatchObject({
            kind: "if",
            routes: { yes: "complaint-declined-notice", no: "complaint-notify" },
        })
        expect(steps.find((step) => step.key === "complaint-notify")).toMatchObject({
            blocking: false,
            next: "to-owner",
        })
        expect(steps.find((step) => step.key === "to-booking")).toMatchObject({
            kind: "call-workflow",
            params: { agent: "booking", workflow: "book" },
        })
        expect(steps.find((step) => step.key === "to-consult")).toMatchObject({
            kind: "call-workflow",
            params: { agent: "sales", workflow: "consult" },
        })
        expect(steps.find((step) => step.key === "to-payment")).toMatchObject({
            kind: "call-workflow",
            params: { agent: "sales", workflow: "payment" },
        })
        // Design change 2026-11-14 (owner final rule 7, R45): the sale reads the engine's thread itself from the visit's start (`since`);
        // only the booking hand-off still carries the recent lines (the money-in graph never read them).
        expect(JSON.stringify(steps.find((step) => step.key === "to-consult"))).not.toContain("recentLines")
        expect(JSON.stringify(steps.find((step) => step.key === "to-consult"))).toContain('"since":{"$ref":"steps.hear.output.startedAt"}')
        expect(JSON.stringify(steps.find((step) => step.key === "to-payment"))).not.toContain("recentLines")
        expect(JSON.stringify(steps.find((step) => step.key === "to-booking"))).toContain('"recentLines":{"$ref":"steps.understand.output.recentLines"}')
        expect(frontDeskGraph.spec.outcomes.map((outcome) => outcome.key).toSorted()).toEqual(["declined", "nothing", "owner"])
    })

    it("front desk declined sends (an owner may set the sends to ask): one team notice, then the outcome declined", () => {
        const steps = frontDeskGraph.spec.nodes
        const stepOf = (key: string) => steps.find((step) => step.key === key)
        for (const [ask, branch] of [
            ["complaint-reply", "complaint-declined"],
            ["answer", "answer-declined"],
        ] as const) {
            expect(stepOf(ask)).toMatchObject({ next: branch })
            expect(stepOf(branch)).toMatchObject({
                kind: "if",
                params: { when: { op: "eq", ref: { $ref: `steps.${ask}.output.declined` }, value: true } },
                routes: { yes: `${branch}-notice` },
            })
            expect(stepOf(`${branch}-notice`)).toMatchObject({
                step: "team.declined-notice",
                blocking: false,
                next: "declined",
            })
        }
        // An answered question still ends the run where it did: the condition has no `no` branch.
        expect(stepOf("answer-declined")?.kind === "if" ? stepOf("answer-declined") : null).not.toHaveProperty(
            "routes.no",
        )
        expect(stepOf("declined")).toMatchObject({ kind: "outcome", params: { outcome: "declined" } })
    })
})
