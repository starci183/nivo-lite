import { digitsOnly, parseDigits } from "@/hooks/loyalty"
import type { LoyaltyRewardType } from "@/hooks/swr"
import type { RewardFormValues, RewardTextField } from "@/modules/types"

/** The kinds of reward the catalogue offers. */
export const REWARD_KINDS: ReadonlyArray<string> = ["voucher", "item", "percent"]

/** The tier select value that means "every tier". */
export const ANY_TIER = "any"

/** The longest reward name. */
export const REWARD_NAME_MAX = 80

/** The longest note shown to the customer. */
export const REWARD_NOTE_MAX = 200

/** A blank form: a new voucher. */
const BLANK_REWARD: RewardFormValues = {
    name: "",
    kind: "voucher",
    cost: "",
    value: "",
    percent: "",
    stock: "",
    limit: "",
    minTier: ANY_TIER,
    note: "",
    active: true,
}

/** The form values of a reward; null starts a blank form. */
export const rewardValuesOf = (reward: LoyaltyRewardType | null): RewardFormValues =>
    reward === null
        ? BLANK_REWARD
        : {
              name: reward.name,
              kind: reward.kind,
              cost: String(reward.pointsCost),
              value: String(reward.valueVnd),
              percent: reward.percent ? String(reward.percent) : "",
              stock: reward.stock === null ? "" : String(reward.stock),
              limit: reward.perCustomerLimit === null ? "" : String(reward.perCustomerLimit),
              minTier: reward.minTierKey ?? ANY_TIER,
              note: reward.note,
              active: reward.active,
          }

/** A typed value masked for its field: names and notes are cut to their limits, numbers keep only digits. */
export const maskRewardField = (field: RewardTextField, value: string): string => {
    if (field === "name") return value.slice(0, REWARD_NAME_MAX)
    if (field === "note") return value.slice(0, REWARD_NOTE_MAX)
    if (field === "kind") return rewardKindOf(value)
    if (field === "minTier") return value === "" ? ANY_TIER : value
    return digitsOnly(value, field === "percent" ? 3 : 10)
}

/** The kind a select answered, or a voucher when it is not one of the kinds. */
export const rewardKindOf = (value: string | null): string => REWARD_KINDS.find((kind) => kind === value) ?? "voucher"

/** The mutation input for the form values; `reward` is the one being edited (null creates). */
export const rewardInputOf = (values: RewardFormValues, reward: LoyaltyRewardType | null) => ({
    id: reward?.id ?? null,
    key: reward?.key ?? null,
    name: values.name.trim(),
    kind: values.kind,
    valueVnd: parseDigits(values.value) ?? 0,
    percent: values.kind === "percent" ? (parseDigits(values.percent) ?? 10) : null,
    pointsCost: parseDigits(values.cost) ?? 0,
    stock: parseDigits(values.stock),
    perCustomerLimit: parseDigits(values.limit),
    minTierKey: values.minTier === ANY_TIER ? null : values.minTier,
    note: values.note.trim(),
    active: values.active,
})

/** The mutation input that keeps a reward as it is and only sets whether it can be redeemed. */
export const rewardToggleInputOf = (reward: LoyaltyRewardType, active: boolean) =>
    rewardInputOf({ ...rewardValuesOf(reward), active }, reward)
