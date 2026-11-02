import { Test } from "@nestjs/testing"
import type { IntentFrame } from "./intent-contracts.contracts"
import { answerNeeded, frameOfIntent, requestFrameOf } from "./intent-frames.policy"

const SUBJECT = Symbol("intent-frames.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { answerNeeded, frameOfIntent, requestFrameOf } }],
    }).compile()
    return moduleRef.get<{
        answerNeeded: typeof answerNeeded
        frameOfIntent: typeof frameOfIntent
        requestFrameOf: typeof requestFrameOf
    }>(SUBJECT)
}

const ACTIONS = [
    { action: "send_quote", amountLimit: true },
    { action: "remind", amountLimit: false },
]

const DOMAIN_FRAME: IntentFrame = {
    ...requestFrameOf("remind", false),
    triggers: ["chat_message"],
    answers: true,
    taskKey: "task.remind",
    result: "domain_result",
}

describe("requestFrameOf", () => {
    it("is the request of a tag, for the manager and the member, read by the generic result and its two checks", async () => {
        const subject = await build()

        const frame = subject.requestFrameOf("remind", false)

        expect(frame).toMatchObject({
            intent: "remind",
            triggers: ["tag"],
            ownTurn: false,
            answers: false,
            result: "agent_request",
            owns: [],
            checks: ["action_is_intent", "action_has_summary"],
        })
        expect(Object.keys(frame.limitKeys)).toEqual(["manager", "member", "outsider", "system"])
        expect(frame.limitKeys.outsider).toContain("intentContracts.limit.request_only")
        expect(frame.limitKeys.system).toContain("intentContracts.limit.staff")
    })

    it("runs in a turn of its own when it is told so", async () => {
        const subject = await build()

        expect(subject.requestFrameOf("remind", true).ownTurn).toBe(true)
    })
})

describe("frameOfIntent", () => {
    it("gives the generic request to any catalogue action for a tag, in a turn of its own when the catalogue says an amount limits it", async () => {
        const subject = await build()

        expect(subject.frameOfIntent([], "send_quote", ACTIONS, "tag")?.ownTurn).toBe(true)
        expect(subject.frameOfIntent([], "remind", ACTIONS, "tag")?.ownTurn).toBe(false)
    })

    it("has no frame for an intent that is not in the catalogue, whatever a domain registered", async () => {
        const subject = await build()

        expect(subject.frameOfIntent([DOMAIN_FRAME], "invent_work", ACTIONS, "tag")).toBeNull()
        expect(
            subject.frameOfIntent([{ ...DOMAIN_FRAME, intent: "invent_work" }], "invent_work", ACTIONS, "chat_message"),
        ).toBeNull()
    })

    it("prefers the frame a domain registered for the trigger, and gives nothing for a trigger no frame accepts", async () => {
        const subject = await build()

        expect(subject.frameOfIntent([DOMAIN_FRAME], "remind", ACTIONS, "chat_message")).toBe(DOMAIN_FRAME)
        expect(subject.frameOfIntent([DOMAIN_FRAME], "send_quote", ACTIONS, "chat_message")).toBeNull()
        expect(subject.frameOfIntent([DOMAIN_FRAME], "remind", ACTIONS, "tag")?.result).toBe("agent_request")
        expect(subject.frameOfIntent([DOMAIN_FRAME], "remind", ACTIONS, "chat_message", true)).toBe(DOMAIN_FRAME)
    })

    it("offers one canonical request for a caller-proven registered trigger, never for a customer or a denied source", async () => {
        const subject = await build()

        expect(subject.frameOfIntent([], "send_quote", ACTIONS, "invoice.paid", true)).toMatchObject({
            triggers: ["invoice.paid"],
            result: "agent_request",
            ownTurn: true,
        })
        expect(subject.frameOfIntent([], "remind", ACTIONS, "invoice.paid", true)?.ownTurn).toBe(false)
        expect(subject.frameOfIntent([], "remind", ACTIONS, "invoice.paid", false)).toBeNull()
        expect(subject.frameOfIntent([], "remind", ACTIONS, "tag", false)).toBeNull()
        expect(subject.frameOfIntent([], "remind", ACTIONS, "customer_message", true)).toBeNull()
        expect(subject.frameOfIntent([], "invent_work", ACTIONS, "invoice.paid", true)).toBeNull()
    })
})

describe("answerNeeded", () => {
    it("is true only for a trigger that some frame answers", async () => {
        const subject = await build()

        expect(subject.answerNeeded([DOMAIN_FRAME], "chat_message")).toBe(true)
        expect(subject.answerNeeded([DOMAIN_FRAME], "tag")).toBe(false)
        expect(subject.answerNeeded([], "chat_message")).toBe(false)
    })
})
