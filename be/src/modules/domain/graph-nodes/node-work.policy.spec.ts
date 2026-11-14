import { Test } from "@nestjs/testing"
import { nodeWorkOf } from "./node-work.policy"

const SUBJECT = Symbol("node-work.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { nodeWorkOf } }],
    }).compile()
    return moduleRef.get<typeof import("./node-work.policy")>(SUBJECT)
}

describe("nodeWorkOf", () => {
    it("books a node's calls to the step of the run step key and to the turn's agent", async () => {
        const subject = await build()
        expect(subject.nodeWorkOf("3355daf0-0000-4000-8000-000000000001:match", "agent-1")).toEqual({
            kind: "node",
            stepKey: "match",
            agentId: "agent-1",
        })
    })

    it("keeps a step key that holds a colon whole, and takes a key with no run part as the step", async () => {
        const subject = await build()
        expect(subject.nodeWorkOf("run-1:approve:send-qr", "a").stepKey).toBe("approve:send-qr")
        expect(subject.nodeWorkOf("match", "a").stepKey).toBe("match")
        expect(subject.nodeWorkOf("run-1:", "a").stepKey).toBeNull()
    })
})

describe("nodeWorkOf: a chat turn (ENG1: the team chat's turn was booked as node work)", () => {
    it("books a step blocks-core declares a chat turn as `chat_turn` to the message it answers, the step and agent kept", async () => {
        const subject = await build()
        expect(subject.nodeWorkOf("run-1:answer", "agent-1", "chat_turn", { roomId: "room-1", messageId: "m-9", text: "35k" })).toEqual({
            kind: "chat_turn",
            ref: "message:room-1/m-9",
            stepKey: "answer",
            agentId: "agent-1",
        })
    })

    it("names no record when the input names no room or message, and stays node work when nothing is declared", async () => {
        const subject = await build()
        expect(subject.nodeWorkOf("run-1:answer", "a", "chat_turn", { roomId: "room-1" }).ref).toBeNull()
        expect(subject.nodeWorkOf("run-1:answer", "a", "chat_turn", null).ref).toBeNull()
        expect(subject.nodeWorkOf("run-1:answer", "a", undefined, { roomId: "room-1", messageId: "m-9" })).toEqual({
            kind: "node",
            stepKey: "answer",
            agentId: "a",
        })
    })
})
