import { Test } from "@nestjs/testing"
import { ResponsibilitiesErrorCode } from "./errors/responsibilities.error"
import { isOwnerId, resolveOwner } from "./responsibility-owner.policy"

const SUBJECT = Symbol("responsibility-owner.policy")

const MEMBER_ID = "11111111-1111-4111-8111-111111111111"
const AGENT_ID = "22222222-2222-4222-8222-222222222222"

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isOwnerId, resolveOwner } }],
    }).compile()
    return moduleRef.get<typeof import("./responsibility-owner.policy")>(SUBJECT)
}

describe("responsibility owner policy", () => {
    describe("isOwnerId", () => {
        it("accepts the id of a member or an agent", async () => {
            const subject = await buildSubject()

            expect(subject.isOwnerId(MEMBER_ID)).toBe(true)
            expect(subject.isOwnerId(MEMBER_ID.toUpperCase())).toBe(true)
        })

        it("rejects the old generic label and any other text", async () => {
            const subject = await buildSubject()

            expect(subject.isOwnerId("human")).toBe(false)
            expect(subject.isOwnerId("")).toBe(false)
            expect(subject.isOwnerId(`${MEMBER_ID}x`)).toBe(false)
        })
    })

    describe("resolveOwner", () => {
        it("makes a member of the workspace the owner under the member's name", async () => {
            const subject = await buildSubject()

            expect(subject.resolveOwner(MEMBER_ID, { member: { id: MEMBER_ID, display_name: "Anh Minh" } })).toEqual({
                kind: "ok",
                value: { kind: "human", agentId: null, memberId: MEMBER_ID, name: "Anh Minh" },
            })
        })

        it("makes an agent of the workspace the owner under the agent's name", async () => {
            const subject = await buildSubject()

            expect(subject.resolveOwner(AGENT_ID, { agent: { id: AGENT_ID, name: "Sales AI" } })).toEqual({
                kind: "ok",
                value: { kind: "agent", agentId: AGENT_ID, memberId: null, name: "Sales AI" },
            })
        })

        it("prefers the member when an id somehow names both", async () => {
            const subject = await buildSubject()

            expect(
                subject.resolveOwner(MEMBER_ID, {
                    member: { id: MEMBER_ID, display_name: "Anh Minh" },
                    agent: { id: MEMBER_ID, name: "Sales AI" },
                }),
            ).toMatchObject({ kind: "ok", value: { kind: "human", memberId: MEMBER_ID } })
        })

        it("refuses an owner that is neither a member nor an agent of the workspace", async () => {
            const subject = await buildSubject()

            expect(subject.resolveOwner(AGENT_ID, {})).toEqual({
                kind: "refused",
                code: ResponsibilitiesErrorCode.OwnerNotFound,
                params: { id: AGENT_ID },
            })
        })
    })
})
