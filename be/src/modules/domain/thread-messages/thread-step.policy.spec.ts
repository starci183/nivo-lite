import { Test } from "@nestjs/testing"
import { refOf, tagStepOf } from "./thread-step.policy"

const SUBJECT = Symbol("thread-step.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { refOf, tagStepOf } }],
    }).compile()
    return moduleRef.get<typeof import("./thread-step.policy")>(SUBJECT)
}

const scope = { workspaceId: "ws-1", threadId: "thread-1", locale: "vi" } as const

describe("thread step policy", () => {
    it("drops the chip name from a tag", async () => {
        const subject = await buildSubject()

        expect(subject.refOf({ kind: "member", id: "minh", name: "Mr Minh" })).toEqual({ kind: "member", id: "minh" })
    })

    it("makes the hand-off step of an agent tagging a person", async () => {
        const subject = await buildSubject()

        expect(
            subject.tagStepOf(scope, { kind: "agent", id: "agent-1" }, "hand_off", "Check the tax id", {
                kind: "member",
                id: "van",
                name: "Van",
            }),
        ).toEqual({
            workspaceId: "ws-1",
            threadId: "thread-1",
            actor: { kind: "agent", id: "agent-1" },
            kind: "hand_off",
            action: "Check the tax id",
            detail: "",
            rule: null,
            target: { kind: "member", id: "van" },
            approvalRequestId: null,
            locale: "vi",
        })
    })

    it("makes the assign step of a person giving an agent work", async () => {
        const subject = await buildSubject()

        expect(
            subject.tagStepOf(scope, { kind: "member", id: "van" }, "assign", "Continue the order", {
                kind: "agent",
                id: "agent-2",
                name: "Accounting AI",
            }),
        ).toMatchObject({ kind: "assign", target: { kind: "agent", id: "agent-2" } })
    })
})
