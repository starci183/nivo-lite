import { Test } from "@nestjs/testing"
import { ResponsibilitiesErrorCode } from "./errors/responsibilities.error"
import { agentToLookUp, resolveOwner } from "./responsibility-owner.policy"

const SUBJECT = Symbol("responsibility-owner.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { agentToLookUp, resolveOwner } }],
    }).compile()
    return moduleRef.get<typeof import("./responsibility-owner.policy")>(SUBJECT)
}

describe("responsibility owner policy", () => {
    describe("agentToLookUp", () => {
        it("looks nothing up for the signed-in person", async () => {
            const subject = await buildSubject()

            expect(subject.agentToLookUp("human")).toBeNull()
        })

        it("looks up the agent a chosen owner names", async () => {
            const subject = await buildSubject()

            expect(subject.agentToLookUp("agent-1")).toBe("agent-1")
        })
    })

    describe("resolveOwner", () => {
        it("makes the signed-in person the owner under their own name", async () => {
            const subject = await buildSubject()

            expect(subject.resolveOwner("human", undefined, "Linh")).toEqual({
                kind: "ok",
                value: { kind: "human", agentId: null, name: "Linh" },
            })
        })

        it("makes an agent of the workspace the owner under the agent's name", async () => {
            const subject = await buildSubject()

            expect(subject.resolveOwner("agent-1", { id: "agent-1", name: "Sales AI" }, "Linh")).toEqual({
                kind: "ok",
                value: { kind: "agent", agentId: "agent-1", name: "Sales AI" },
            })
        })

        it("refuses an owner that is not an agent of the workspace", async () => {
            const subject = await buildSubject()

            expect(subject.resolveOwner("agent-9", undefined, "Linh")).toEqual({
                kind: "refused",
                code: ResponsibilitiesErrorCode.AgentNotFound,
                params: { id: "agent-9" },
            })
        })
    })
})
