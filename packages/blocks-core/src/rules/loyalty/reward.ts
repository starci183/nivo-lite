import { fold } from "./fold"
import type { RewardEdit, RewardPreset } from "./reward.types"

const INTEGER_MAX = 2_147_483_647

const integer = (value: number, min: number, max = INTEGER_MAX): number =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : min

/** A catalogue key safe for the database, with space left for a collision suffix. */
export const rewardKey = (name: string): string => {
    const normalized = fold(name)
        .replace(/[^a-z0-9_-]+/gu, "-")
        .slice(0, 30)
    let start = 0
    let end = normalized.length
    while (start < end && (normalized[start] === "-" || normalized[start] === "_")) start += 1
    while (end > start && (normalized[end - 1] === "-" || normalized[end - 1] === "_")) end -= 1
    return normalized.slice(start, end) || "reward"
}

/** The catalogue fields bounded for storage; required name and cost are checked by the action. */
export const sanitizeReward = (edit: RewardEdit): RewardEdit => ({
    ...edit,
    name: edit.name.trim().slice(0, 80),
    valueVnd: integer(edit.valueVnd, 0, 1e12),
    percent: edit.kind === "percent" ? integer(edit.percent ?? 10, 1, 100) : null,
    pointsCost: integer(edit.pointsCost, 1),
    stock: edit.stock === null ? null : integer(edit.stock, 0),
    perCustomerLimit: edit.perCustomerLimit === null ? null : integer(edit.perCustomerLimit, 1),
    minTierKey: edit.minTierKey?.trim().slice(0, 40) || null,
    note: edit.note.trim().slice(0, 200),
})

/** The starter rewards an owner can add without replacing their saved catalogue. */
export const REWARD_PRESETS: ReadonlyArray<RewardPreset> = [
    {
        key: "voucher-50k",
        kind: "voucher",
        valueVnd: 50000,
        percent: null,
        pointsCost: 500,
        stock: null,
        perCustomerLimit: null,
        minTierKey: null,
        nameKey: "preset_voucher_name",
        noteKey: "preset_voucher_note",
        active: true,
    },
    {
        key: "giam-10",
        kind: "percent",
        valueVnd: 100000,
        percent: 10,
        pointsCost: 800,
        stock: null,
        perCustomerLimit: 2,
        minTierKey: null,
        nameKey: "preset_percent_name",
        noteKey: "preset_percent_note",
        active: true,
    },
    {
        key: "qua-tang",
        kind: "item",
        valueVnd: 150000,
        percent: null,
        pointsCost: 1200,
        stock: 20,
        perCustomerLimit: 1,
        minTierKey: "bac",
        nameKey: "preset_gift_name",
        noteKey: "preset_gift_note",
        active: true,
    },
]

/** The starter rewards with their names and notes written by `words`, a lookup of the module's messages. */
export const presetEdits = (words: (key: string) => string): ReadonlyArray<RewardEdit> =>
    REWARD_PRESETS.map(({ nameKey, noteKey, ...reward }): RewardEdit => ({
        ...reward,
        name: words(nameKey),
        note: words(noteKey),
    }))
