import { Test } from "@nestjs/testing"
import { firstChangedInvite as realFirstChangedInvite } from "./changed-invite.policy"

const SUBJECT = Symbol("changed-invite.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { firstChangedInvite: realFirstChangedInvite } }],
    }).compile()
    return moduleRef.get<{ firstChangedInvite: typeof realFirstChangedInvite }>(SUBJECT)
}

const CHANGED = { id: "invite-1", email: "an@example.test", role: "staff" }

describe("firstChangedInvite", () => {
    it("takes the first well-formed invitation a write answered", async () => {
        const subject = await buildSubject()

        expect(subject.firstChangedInvite([{ id: 1 }, CHANGED])).toEqual(CHANGED)
    })

    it.each([undefined, {}, [], [null], [{ id: "invite-1" }]])("takes none from the raw answer %p", async (raw) => {
        const subject = await buildSubject()

        expect(subject.firstChangedInvite(raw)).toBeUndefined()
    })
})
