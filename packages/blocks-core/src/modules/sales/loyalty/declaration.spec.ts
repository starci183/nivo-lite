import { seedSpecProblems } from "@nivo-lite/agent-sdk/module"
import { coreBlocks } from "../../../blocks/core-blocks"
import { platformModule } from "../../platform/declaration"
import { salesModule } from "../declaration"
import { SALES_WORKBENCH_SPEC } from "../specs/sales.workbench"
import { LOYALTY_ACTIONS, LOYALTY_READS } from "./declaration"
import { LOYALTY_MESSAGES } from "./loyalty-messages"

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
].map((reason) => `loyalty_refusal_${reason}`)

/** The views the loyalty area draws in the Sales workbench. */
const LOYALTY_VIEWS = ["loyalty-overview", "members", "rewards", "promo", "pending", "program"]

describe("the loyalty area of the Sales module", () => {
    it("declares its reads and actions in the Sales module, with the Sales permissions and the loyalty decide", () => {
        expect(LOYALTY_READS).toHaveLength(16)
        expect(LOYALTY_ACTIONS).toHaveLength(12)
        for (const read of LOYALTY_READS) expect(read.id.startsWith("blocks-core.sales.api.loyalty-")).toBe(true)
        for (const action of LOYALTY_ACTIONS) expect(action.id.startsWith("sales.loyalty-")).toBe(true)
        const reads = salesModule.reads.map((read) => read.id)
        const actions = salesModule.actions.map((action) => action.id)
        for (const read of LOYALTY_READS) expect(reads).toContain(read.id)
        for (const action of LOYALTY_ACTIONS) expect(actions).toContain(action.id)
        expect(salesModule.permissions).toEqual(expect.arrayContaining(["sales.view", "sales.manage", "sales.loyalty-decide"]))
    })

    it("draws the overview, members, rewards, promotions, pending decisions and settings in the Sales workbench", () => {
        expect(seedSpecProblems(salesModule, coreBlocks, [platformModule])).toEqual([])
        const ids = SALES_WORKBENCH_SPEC.views.map((view) => view.id)
        for (const id of LOYALTY_VIEWS) expect(ids).toContain(id)
    })

    it("has words in both languages for every text its views, its actions and its refusals name", () => {
        const views = SALES_WORKBENCH_SPEC.views.filter((view) => LOYALTY_VIEWS.includes(view.id))
        const named = [...keysIn(views), ...LOYALTY_ACTIONS.flatMap((action) => keysIn(action.label)), ...REFUSALS]
        const missing = named.filter(
            (key) => !Object.keys(LOYALTY_MESSAGES.en).includes(key) || !Object.keys(LOYALTY_MESSAGES.vi).includes(key),
        )
        expect(missing).toEqual([])
    })

    it("keeps the same keys in both languages", () => {
        expect(Object.keys(LOYALTY_MESSAGES.vi).sort()).toEqual(Object.keys(LOYALTY_MESSAGES.en).sort())
    })
})
