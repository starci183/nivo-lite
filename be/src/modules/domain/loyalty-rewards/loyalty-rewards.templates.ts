import type { RewardPreset } from "./loyalty-rewards.contracts"

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
        nameKey: "loyalty.rewardPreset.voucher50k.name",
        noteKey: "loyalty.rewardPreset.voucher50k.note",
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
        nameKey: "loyalty.rewardPreset.percent10.name",
        noteKey: "loyalty.rewardPreset.percent10.note",
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
        nameKey: "loyalty.rewardPreset.shopGift.name",
        noteKey: "loyalty.rewardPreset.shopGift.note",
        active: true,
    },
]
