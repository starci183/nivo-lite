import { defineAction } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { presetEdits, rewardKey, sanitizeReward } from "../../../rules/loyalty/reward"
import { LOYALTY_MANAGE } from "../constants"
import vi from "../messages/vi.json"
import { addMissingRewards, removeReward, saveReward } from "../loyalty-catalogue-data"
import { LEDGER, REWARDS } from "../ports"
import { CONFLICT, refusedWith } from "../refusals"
import { hostRecordId } from "./record-id"

const REWARD_READS = ["loyalty.rewards", "loyalty.reward", "loyalty.member-rewards"] as const

const saveInput: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>
    name: z.ZodString
    kind: z.ZodEnum<{ voucher: "voucher"; item: "item"; percent: "percent" }>
    valueVnd: z.ZodOptional<z.ZodNullable<z.ZodNumber>>
    percent: z.ZodOptional<z.ZodNullable<z.ZodNumber>>
    pointsCost: z.ZodNumber
    stock: z.ZodOptional<z.ZodNullable<z.ZodNumber>>
    perCustomerLimit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>
    minTierKey: z.ZodOptional<z.ZodNullable<z.ZodString>>
    note: z.ZodOptional<z.ZodString>
    active: z.ZodOptional<z.ZodBoolean>
}> = z.object({
    id: z.string().max(MAX_ID).optional(),
    name: z.string().trim().min(1).max(200),
    kind: z.enum(["voucher", "item", "percent"]),
    valueVnd: z.number().min(0).max(1e12).nullable().optional(),
    percent: z.number().min(0).max(1000).nullable().optional(),
    pointsCost: z.number().min(1).max(2_147_483_647),
    stock: z.number().min(0).max(2_147_483_647).nullable().optional(),
    perCustomerLimit: z.number().min(0).max(2_147_483_647).nullable().optional(),
    minTierKey: z.string().max(80).nullable().optional(),
    note: z.string().max(500).optional(),
    active: z.boolean().optional(),
})

/**
 * `loyalty.save-reward`: creates a reward, or changes the one the id names. The fields are bounded for storage; a new reward gets
 * a catalogue key made from its name.
 */
export const saveRewardAction: ActionDefinition = defineAction({
    id: "loyalty.save-reward",
    permission: LOYALTY_MANAGE,
    label: { key: "action_save_reward" },
    input: saveInput,
    ports: { rewards: REWARDS },
    transactional: true,
    run: async ({ rewards }, input) => {
        const id = input.id === undefined || input.id === "" ? undefined : input.id
        const edit = sanitizeReward({
            id,
            ...(id === undefined ? { key: rewardKey(input.name) } : {}),
            name: input.name,
            kind: input.kind,
            valueVnd: input.valueVnd ?? 0,
            percent: input.percent ?? null,
            pointsCost: input.pointsCost,
            stock: input.stock ?? null,
            perCustomerLimit: input.perCustomerLimit ?? null,
            minTierKey: input.minTierKey ?? null,
            note: input.note ?? "",
            active: input.active ?? true,
        })
        const written = await saveReward(rewards, edit)
        if (written.ok) return { ok: true, data: { id: written.row.id } }
        return written.reason === "missing" ? refusedWith("reward_missing") : CONFLICT
    },
    refreshes: REWARD_READS,
    optimistic: false,
})

/** `loyalty.remove-reward`: deletes a reward nobody redeemed; one with history is paused instead. */
export const removeRewardAction: ActionDefinition = defineAction({
    id: "loyalty.remove-reward",
    permission: LOYALTY_MANAGE,
    label: { key: "action_remove_reward" },
    input: z.object({ id: z.string().min(1).max(MAX_ID) }),
    ports: { rewards: REWARDS, ledger: LEDGER },
    transactional: true,
    run: async ({ rewards, ledger }, { id }) => {
        const removal = await removeReward(rewards, ledger, id)
        return removal === "missing" ? refusedWith("reward_missing") : { ok: true, data: { removal } }
    },
    refreshes: REWARD_READS,
    optimistic: false,
})

/**
 * `loyalty.add-preset-rewards`: adds the starter rewards the catalogue lacks, without touching the saved ones. Their names are
 * written in Vietnamese, the stored language of the programme.
 */
export const addPresetRewardsAction: ActionDefinition = defineAction({
    id: "loyalty.add-preset-rewards",
    permission: LOYALTY_MANAGE,
    label: { key: "action_add_preset_rewards" },
    input: z.object({ id: hostRecordId }),
    ports: { rewards: REWARDS },
    transactional: true,
    run: async ({ rewards }) => ({ ok: true, data: { added: await addMissingRewards(rewards, presetEdits(vi)) } }),
    refreshes: REWARD_READS,
    optimistic: false,
})
