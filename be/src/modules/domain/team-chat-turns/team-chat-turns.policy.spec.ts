import { Test } from "@nestjs/testing"
import {
    ASKED_VI,
    DROPS_TRUTH_VI,
    FEE_VALUE_VI,
    LINE_ONE_VI,
    LINE_TWO_VI,
    PRESSED_BY_VI,
    QUESTION_VI,
} from "@tests/fixtures/i18n/team-chat-turns-spec.messages"
import type { TurnParams } from "./team-chat-turns.contracts"
import {
    agentMessageKindOf,
    agentOfDirectKey,
    captureReasonOf,
    fittedParamsOf,
    roomAdmissionOf,
    standingOf,
    turnLinesOf,
} from "./team-chat-turns.policy"

const SUBJECT = Symbol("team-chat-turns.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { agentMessageKindOf, agentOfDirectKey, captureReasonOf, fittedParamsOf, roomAdmissionOf, standingOf, turnLinesOf },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./team-chat-turns.policy")>(SUBJECT)
}

const PARAMS: TurnParams = {
    roomId: "r",
    messageId: "m",
    text: QUESTION_VI,
    room: "common",
    intent: "answer",
    asker: { name: "Anh", standing: "owner" },
    lines: Array.from({ length: 12 }, (_, index) => ({
        id: `l${String(index)}`,
        by: "person" as const,
        name: "Lan",
        text: "x".repeat(300),
        at: "2026-11-11T10:00:00.000Z",
    })),
    replyTo: null,
    locale: "vi",
}

describe("team-chat-turns.policy", () => {
    it("reads the agent of a direct room from its pair, and none from a room of two people", async () => {
        const subject = await build()
        expect(subject.agentOfDirectKey("agent:a1|user:u1")).toBe("a1")
        expect(subject.agentOfDirectKey("user:u1|user:u2")).toBeNull()
        expect(subject.agentOfDirectKey(null)).toBeNull()
        expect(subject.agentOfDirectKey("system:nivo|user:u1")).toBeNull()
    })

    it("reads the kind of a stored agent message, and none of a plain line or broken text", async () => {
        const subject = await build()
        expect(subject.agentMessageKindOf('{"kind":"workflow.stopped"}')).toBe("workflow.stopped")
        expect(subject.agentMessageKindOf(null)).toBeNull()
        expect(subject.agentMessageKindOf("not json")).toBeNull()
    })

    it("cuts the params to what a wake keeps: oldest lines first, the asked words kept", async () => {
        const subject = await build()
        const fitted = subject.fittedParamsOf(PARAMS, 3000)
        expect(JSON.stringify(fitted).length).toBeLessThanOrEqual(3000)
        expect(fitted.lines.at(-1)?.id).toBe("l11")
        expect(fitted.text).toBe(QUESTION_VI)
        expect(subject.fittedParamsOf(PARAMS)).toBe(PARAMS)
    })

    it("admits turns under the limit, says the pause once, then stays quiet until the window frees a place", async () => {
        const subject = await build()
        const limit = { turns: 2, windowMs: 1000 }
        expect(subject.roomAdmissionOf([100], false, 500, limit)).toBe("run")
        expect(subject.roomAdmissionOf([100, 200], false, 500, limit)).toBe("pause_notice")
        expect(subject.roomAdmissionOf([100, 200], true, 500, limit)).toBe("quiet")
        expect(subject.roomAdmissionOf([100, 200], true, 1150, limit)).toBe("run")
    })

    it("maps roles to standings and keeps room lines oldest first without the asked message", async () => {
        const subject = await build()
        expect([subject.standingOf("owner"), subject.standingOf("manager"), subject.standingOf("staff"), subject.standingOf("other")]).toEqual([
            "owner",
            "manager",
            "staff",
            "staff",
        ])
        const at = (minute: number) => new Date(Date.UTC(2026, 10, 11, 10, minute))
        const lines = subject.turnLinesOf(
            [
                { id: "b", authorKind: "agent", authorId: "a1", body: LINE_TWO_VI, createdAt: at(2) },
                { id: "asked", authorKind: "user", authorId: "u1", body: ASKED_VI, createdAt: at(3) },
                { id: "a", authorKind: "user", authorId: "u1", body: LINE_ONE_VI, createdAt: at(1) },
                { id: "c", authorKind: "system", authorId: null, body: " ", createdAt: at(0) },
            ],
            "asked",
            new Map([
                ["u1", "Anh"],
                ["a1", "Sales"],
            ]),
        )
        expect(lines.map((line) => `${line.by}:${line.name}:${line.text}`)).toEqual([`person:Anh:${LINE_ONE_VI}`, `agent:Sales:${LINE_TWO_VI}`])
    })

    it("writes a hand-filed reason that says who pressed it and is never the value", async () => {
        const subject = await build()
        expect(subject.captureReasonOf("Anh", FEE_VALUE_VI)).toContain(`Anh ${PRESSED_BY_VI}`)
        expect(subject.captureReasonOf("Anh", FEE_VALUE_VI)).not.toBe(FEE_VALUE_VI)
        expect(subject.captureReasonOf("Anh", null)).toContain(DROPS_TRUTH_VI)
    })
})
