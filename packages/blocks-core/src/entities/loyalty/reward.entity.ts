import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"

import { MAX_ID, MAX_LINE } from "../../bounds"

/** What a reward gives. */
export const REWARD_KINDS: readonly [string, ...Array<string>] = ["voucher", "item", "percent"]

type RewardFields = {
    readonly key: FieldDef<"text", false>
    readonly name: FieldDef<"text", false>
    readonly kind: FieldDef<"enum", false>
    readonly valueVnd: FieldDef<"money_vnd", false>
    readonly percent: FieldDef<"int", true>
    readonly pointsCost: FieldDef<"int", false>
    readonly stock: FieldDef<"int", true>
    readonly perCustomerLimit: FieldDef<"int", true>
    readonly minTierKey: FieldDef<"text", true>
    readonly note: FieldDef<"text", false>
    readonly active: FieldDef<"bool", false>
}

const rewardFields: RewardFields = {
    key: field.text({ maxLength: MAX_ID }),
    name: field.text({ maxLength: MAX_LINE, searchable: true }),
    kind: field.enum({ of: REWARD_KINDS, default: { literal: "voucher" } }),
    valueVnd: field.moneyVnd({ default: { literal: 0 } }),
    percent: field.int({ nullable: true }),
    pointsCost: field.int({ default: { literal: 0 } }),
    stock: field.int({ nullable: true }),
    perCustomerLimit: field.int({ nullable: true }),
    minTierKey: field.text({ maxLength: MAX_ID, nullable: true }),
    note: field.text({ maxLength: 2_000, default: "empty" }),
    active: field.bool({ default: { literal: true } }),
}

/** A reward of the catalogue a customer can redeem points for. Graph node kind `loyalty-reward`. */
export const loyaltyRewardEntity: EntityDefinition<RewardFields> = defineEntity({
    name: "loyalty.reward",
    dataKind: "loyalty-reward",
    fields: rewardFields,
    indexes: [
        { name: "recent", on: [{ desc: "createdAt" }, { desc: "id" }] },
        { name: "active_recent", on: ["active", { desc: "createdAt" }, { desc: "id" }] },
        { name: "key", on: ["key", "id"] },
    ],
    constraints: [{ kind: "unique", name: "key_key", on: ["key"], refusal: "reward-key-taken" }],
})
