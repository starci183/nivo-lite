import { Test } from "@nestjs/testing"
import { buildTemplate } from "@tests/fixtures/builders/automations.builder"
import { CLASSIFY_SYSTEM, FEEDBACK_MAX, caseSystem, proposalSystem, shopBlock } from "./prompt.policy"

const SUBJECT = Symbol("prompt.policy")

type PolicySubject = {
    shopBlock: typeof shopBlock
    proposalSystem: typeof proposalSystem
    caseSystem: typeof caseSystem
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    shopBlock,
                    proposalSystem,
                    caseSystem,
                },
            },
        ],
    }).compile()
    return moduleRef.get<PolicySubject>(SUBJECT)
}

describe("shopBlock", () => {
    it("lists the name, the hours, the tone and what the shop said about itself", async () => {
        const subject = await buildSubject()

        const block = subject.shopBlock({ shop: "Tiem Hoa", hours: "08:00 - 21:00", tone: "warm" }, "We sell flowers.")

        expect(block.split("\n")).toEqual([
            "Shop name: Tiem Hoa",
            "Opening hours: 08:00 - 21:00",
            "Tone / brand voice: warm",
            "What the shop told NIVO about itself:",
            "We sell flowers.",
        ])
    })

    it("leaves out what is empty and cuts a long context", async () => {
        const subject = await buildSubject()

        expect(subject.shopBlock({ shop: "Tiem Hoa", hours: "", tone: "" }, "")).toBe("Shop name: Tiem Hoa")
        expect(subject.shopBlock({ shop: "S", hours: "", tone: "" }, "x".repeat(3000)).length).toBeLessThan(2600)
    })
})

describe("system instructions", () => {
    const def = buildTemplate({
        guardrails: [
            { vi: "Khong hua.", en: "No promises." },
            { vi: "Khong gia.", en: "No prices." },
        ],
    })

    it("tells a model to keep the placeholders of the base wording and to follow the guardrails", async () => {
        const subject = await buildSubject()

        const system = subject.proposalSystem(def, "Hi {ten_khach}, {so_tien}")

        expect(system).toContain("({ten_khach}, {so_tien})")
        expect(system).toContain("Guardrails: Khong hua. Khong gia.")
    })

    it("tells a model to write one message inside the approved wording", async () => {
        const subject = await buildSubject()

        expect(subject.caseSystem(def)).toContain("Guardrails: Khong hua. Khong gia.")
    })

    it("fixes the classification instruction and the length of feedback it reads", () => {
        expect(CLASSIFY_SYSTEM).toContain("POSITIVE, NEUTRAL or NEGATIVE")
        expect(FEEDBACK_MAX).toBe(500)
    })
})
