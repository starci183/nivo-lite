import type { ActionResult } from "@nivo-lite/agent-sdk/block"
import type { RedeemBlockCode } from "../../../rules/sales/loyalty/reward.types"

/** Why a Loyalty action refused, each with a message of the module. */
export type LoyaltyRefusal =
    | "member_missing"
    | "reward_missing"
    | "points_required"
    | "reason_required"
    | "birthday_invalid"
    | "phone_invalid"
    | "redeem_key_invalid"
    | "decision_missing"
    | `not_redeemable_${RedeemBlockCode}`

/** A domain refusal as data: the words come from the module's catalogue under `loyalty_refusal_<reason>`. */
export const refusedWith = (reason: LoyaltyRefusal): ActionResult => ({
    ok: false,
    reason: "refused",
    message: { key: `loyalty_refusal_${reason}` },
})

/** The answer to a write another writer got to first: the person reloads and tries again. */
export const CONFLICT: ActionResult = { ok: false, reason: "conflict", message: { key: "loyalty_refusal_conflict" } }
