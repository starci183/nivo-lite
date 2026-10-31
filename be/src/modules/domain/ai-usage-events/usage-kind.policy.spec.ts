import { Test } from "@nestjs/testing"
import { usageKindOf } from "./usage-kind.policy"

const SUBJECT = Symbol("usage-kind.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { usageKindOf } }],
    }).compile()
    return moduleRef.get<{ usageKindOf: typeof usageKindOf }>(SUBJECT)
}

describe("usageKindOf", () => {
    it.each(["chat_reply", "setup", "owner_chat", "relay", "embedding", "engine", "guide", "brain", "office_command"])(
        "keeps the known kind %s",
        async (kind) => {
            const subject = await build()

            expect(subject.usageKindOf(kind)).toBe(kind)
        },
    )

    it("keeps the kind of a tag or background turn, which is metered apart from customer replies", async () => {
        const subject = await build()

        expect(subject.usageKindOf("agent_work")).toBe("agent_work")
    })

    it("books a kind the meter does not know as engine work", async () => {
        const subject = await build()

        expect(subject.usageKindOf("mystery")).toBe("engine")
        expect(subject.usageKindOf("toString")).toBe("engine")
    })
})
