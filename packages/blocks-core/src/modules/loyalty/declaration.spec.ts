import { seedSpecProblems } from "@nivo-lite/agent-sdk/module"
import { coreBlocks } from "../../blocks/core-blocks"
import { LOYALTY_MODULE_KEY, loyaltyModule } from "./declaration"
import { LOYALTY_MESSAGES } from "./loyalty-messages"
import { LOYALTY_WORKBENCH_SPEC } from "./specs/loyalty.workbench"

/** Every message key a value names, anywhere in it: an object with one string `key`. */
const keysIn = (value: unknown): ReadonlyArray<string> => {
    if (Array.isArray(value)) return value.flatMap(keysIn)
    if (typeof value !== "object" || value === null) return []
    const own: unknown = "key" in value ? value.key : undefined
    const nested = Object.values(value).flatMap(keysIn)
    return typeof own === "string" ? [own, ...nested] : nested
}

const REFUSALS = [
    "birthday_invalid",
    "conflict",
    "decision_missing",
    "member_missing",
    "not_redeemable_inactive",
    "not_redeemable_limit_reached",
    "not_redeemable_not_enough_points",
    "not_redeemable_out_of_stock",
    "not_redeemable_tier_required",
    "phone_invalid",
    "points_required",
    "reason_required",
    "redeem_key_invalid",
    "reward_missing",
].map((reason) => `refusal_${reason}`)

describe("the Loyalty declaration", () => {
    it("declares the reads and actions the workbench uses, each under the module key", () => {
        expect(loyaltyModule.key).toBe(LOYALTY_MODULE_KEY)
        expect(loyaltyModule.reads.map((read) => read.id)).toHaveLength(15)
        expect(loyaltyModule.actions.map((action) => action.id)).toHaveLength(12)
        expect(loyaltyModule.permissions).toEqual(["loyalty.view", "loyalty.manage", "loyalty.decide"])
    })

    it("seeds a spec the core blocks, the reads and the actions of the module admit", () => {
        expect(seedSpecProblems(loyaltyModule, coreBlocks)).toEqual([])
    })

    it("draws the overview, members, rewards, promotions, pending decisions and settings", () => {
        expect(LOYALTY_WORKBENCH_SPEC.views.map((view) => view.id)).toEqual([
            "overview",
            "members",
            "rewards",
            "promo",
            "pending",
            "program",
        ])
    })

    it("has words in both languages for every text the spec, the actions and the refusals name", () => {
        const named = [
            ...keysIn(LOYALTY_WORKBENCH_SPEC),
            ...loyaltyModule.actions.flatMap((action) => keysIn(action.label)),
            ...REFUSALS,
        ]
        const missing = named.filter(
            (key) => !Object.keys(LOYALTY_MESSAGES.en).includes(key) || !Object.keys(LOYALTY_MESSAGES.vi).includes(key),
        )
        expect(missing).toEqual([])
    })

    it("keeps the same keys in both languages", () => {
        expect(Object.keys(LOYALTY_MESSAGES.vi).sort()).toEqual(Object.keys(LOYALTY_MESSAGES.en).sort())
    })
})
