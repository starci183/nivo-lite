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

const PARAMS: TurnParams = {
    roomId: "r",
    messageId: "m",
    text: "câu hỏi",
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
    it("reads the agent of a direct room from its pair, and none from a room of two people", () => {
        expect(agentOfDirectKey("agent:a1|user:u1")).toBe("a1")
        expect(agentOfDirectKey("user:u1|user:u2")).toBeNull()
        expect(agentOfDirectKey(null)).toBeNull()
    })

    it("reads the kind of a stored agent message, and none of a plain line or broken text", () => {
        expect(agentMessageKindOf('{"kind":"workflow.stopped"}')).toBe("workflow.stopped")
        expect(agentMessageKindOf(null)).toBeNull()
        expect(agentMessageKindOf("not json")).toBeNull()
    })

    it("cuts the params to what a wake keeps: oldest lines first, the asked words kept", () => {
        const fitted = fittedParamsOf(PARAMS, 3000)
        expect(JSON.stringify(fitted).length).toBeLessThanOrEqual(3000)
        expect(fitted.lines.at(-1)?.id).toBe("l11")
        expect(fitted.text).toBe("câu hỏi")
        expect(fittedParamsOf(PARAMS)).toBe(PARAMS)
    })

    it("admits turns under the limit, says the pause once, then stays quiet until the window frees a place", () => {
        const limit = { turns: 2, windowMs: 1000 }
        expect(roomAdmissionOf([100], false, 500, limit)).toBe("run")
        expect(roomAdmissionOf([100, 200], false, 500, limit)).toBe("pause_notice")
        expect(roomAdmissionOf([100, 200], true, 500, limit)).toBe("quiet")
        expect(roomAdmissionOf([100, 200], true, 1150, limit)).toBe("run")
    })

    it("maps roles to standings and keeps room lines oldest first without the asked message", () => {
        expect([standingOf("owner"), standingOf("manager"), standingOf("staff"), standingOf("other")]).toEqual([
            "owner",
            "manager",
            "staff",
            "staff",
        ])
        const at = (minute: number) => new Date(Date.UTC(2026, 10, 11, 10, minute))
        const lines = turnLinesOf(
            [
                { id: "b", authorKind: "agent", authorId: "a1", body: "hai", createdAt: at(2) },
                { id: "asked", authorKind: "user", authorId: "u1", body: "hỏi", createdAt: at(3) },
                { id: "a", authorKind: "user", authorId: "u1", body: "một", createdAt: at(1) },
                { id: "c", authorKind: "system", authorId: null, body: " ", createdAt: at(0) },
            ],
            "asked",
            new Map([
                ["u1", "Anh"],
                ["a1", "Sales"],
            ]),
        )
        expect(lines.map((line) => `${line.by}:${line.name}:${line.text}`)).toEqual(["person:Anh:một", "agent:Sales:hai"])
    })

    it("writes a hand-filed reason that says who pressed it and is never the value", () => {
        expect(captureReasonOf("Anh", "30.000 đ")).toContain("Anh bấm")
        expect(captureReasonOf("Anh", "30.000 đ")).not.toBe("30.000 đ")
        expect(captureReasonOf("Anh", null)).toContain("bỏ sự thật")
    })
})
