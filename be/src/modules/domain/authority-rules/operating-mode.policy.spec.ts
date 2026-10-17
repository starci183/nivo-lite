import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { AuthorityRule } from "./authority-rules.contracts"
import { applyOperatingMode as realApplyOperatingMode } from "./operating-mode.policy"

const SUBJECT = Symbol("operating-mode.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { applyOperatingMode: realApplyOperatingMode } }],
    }).compile()
    const subject = moduleRef.get<{ applyOperatingMode: typeof realApplyOperatingMode }>(SUBJECT)
    return { subject }
}

const ruleOf = builder<AuthorityRule>({
    id: "rule-1",
    department: "sales",
    action: "confirm_order",
    mode: "auto",
    limit_vnd: null,
    required_fields: [],
})

describe("applyOperatingMode", () => {
    it("downgrades an auto rule in assist mode", async () => {
        const { subject } = await buildSubject()

        expect(subject.applyOperatingMode(ruleOf(), "assist")).toEqual(ruleOf({ mode: "ask" }))
    })

    it.each(["autopilot", null, undefined] as const)("keeps an auto rule when the mode is %s", async (mode) => {
        const { subject } = await buildSubject()

        expect(subject.applyOperatingMode(ruleOf(), mode)).toEqual(ruleOf())
    })

    it.each(["ask", "never"] as const)("keeps a %s rule in assist mode", async (mode) => {
        const { subject } = await buildSubject()

        expect(subject.applyOperatingMode(ruleOf({ mode }), "assist")).toEqual(ruleOf({ mode }))
    })

    it("keeps a missing rule missing", async () => {
        const { subject } = await buildSubject()

        expect(subject.applyOperatingMode(null, "assist")).toBeNull()
    })
})
