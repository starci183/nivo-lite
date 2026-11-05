import { Test } from "@nestjs/testing"
import { participantsOf } from "./thread-participants.policy"

const SUBJECT = Symbol("policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { participantsOf } }],
    }).compile()
    return moduleRef.get<{ participantsOf: typeof participantsOf }>(SUBJECT)
}

describe("participantsOf", () => {
    it("counts the distinct members and agents that wrote or were tagged, and no group", async () => {
        const { participantsOf } = await buildSubject()
        expect(
            participantsOf([
                { author_kind: "member", author_id: "m-1", mentions: [{ kind: "agent", id: "a-1" }] },
                {
                    author_kind: "agent",
                    author_id: "a-1",
                    mentions: [
                        { kind: "member", id: "m-1" },
                        { kind: "member", id: "m-2" },
                        { kind: "group", id: "managers" },
                    ],
                },
                { author_kind: "system", author_id: "s-1", mentions: [] },
            ]),
        ).toEqual({ people: 2, agents: 1 })
    })

    it("answers zero for a thread with no messages", async () => {
        const { participantsOf } = await buildSubject()
        expect(participantsOf([])).toEqual({ people: 0, agents: 0 })
    })
})
