import { Test } from "@nestjs/testing"
import { eventDedupeKey, bankDedupeKey } from "./inbound-dedupe.policy"
const POLICY = Symbol("./inbound-dedupe.policy")
type PolicySubject = { bankDedupeKey: typeof bankDedupeKey; eventDedupeKey: typeof eventDedupeKey }

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: POLICY, useValue: { bankDedupeKey, eventDedupeKey } }],
    }).compile()
    const subject = moduleRef.get<PolicySubject>(POLICY)
    return { subject }
}

describe("inbound dedupe policy", () => {
    it("keys a bank payment by its trimmed event id", async () => {
        const { subject } = await buildSubject()

        expect(subject.bankDedupeKey(" casso:42 ")).toBe("bank:payment:casso:42")
    })
})

describe("channel event dedupe", () => {
    it("keeps channel and kind distinct while trimming the provider event id", async () => {
        const { subject } = await buildSubject()

        expect(subject.eventDedupeKey("zalo", "message", " evt-42 ")).toBe("zalo:message:evt-42")
        expect(subject.eventDedupeKey("telegram", "payment", "evt-42")).toBe("telegram:payment:evt-42")
    })
})
