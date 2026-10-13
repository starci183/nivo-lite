import type { RewardEdit } from "../loyalty-rewards.contracts"

const INTEGER_MAX = 2_147_483_647

const integer = (value: number, min: number, max = INTEGER_MAX): number =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : min

/** A catalogue key safe for the database, with space left for a collision suffix. */
export const rewardKey = (name: string): string =>
    name
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .replace(/\u0111/giu, "d")
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/gu, "-")
        .slice(0, 30)
        .replace(/^[-_]+|[-_]+$/gu, "") || "reward"

/** The catalogue fields bounded for storage; required name and cost are checked by the authorised facade. */
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
