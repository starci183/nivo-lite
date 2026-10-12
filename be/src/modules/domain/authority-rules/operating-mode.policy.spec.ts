import { builder } from "@starci/jest-preset"
import type { AuthorityRule } from "./authority-rules.contracts"
import { applyOperatingMode } from "./operating-mode.policy"

const ruleOf = builder<AuthorityRule>({
    id: "rule-1",
    department: "sales",
    action: "confirm_order",
    mode: "auto",
    limit_vnd: null,
    required_fields: [],
})

describe("applyOperatingMode", () => {
    it("downgrades an auto rule in assist mode", () => {
        expect(applyOperatingMode(ruleOf(), "assist")).toEqual(ruleOf({ mode: "ask" }))
    })

    it.each(["autopilot", null, undefined] as const)("keeps an auto rule when the mode is %s", (mode) => {
        expect(applyOperatingMode(ruleOf(), mode)).toEqual(ruleOf())
    })

    it.each(["ask", "never"] as const)("keeps a %s rule in assist mode", (mode) => {
        expect(applyOperatingMode(ruleOf({ mode }), "assist")).toEqual(ruleOf({ mode }))
    })

    it("keeps a missing rule missing", () => {
        expect(applyOperatingMode(null, "assist")).toBeNull()
    })
})
