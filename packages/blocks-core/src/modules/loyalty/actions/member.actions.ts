import { defineAction } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../../bounds"
import { tierByKey, tierFor, tierRank } from "../../../rules/loyalty/config"
import { customerBirthday, toLoyaltyPhone } from "../../../rules/loyalty/contact"
import { expiryDate } from "../../../rules/loyalty/expiry"
import { earnEvidence, pointsFor } from "../../../rules/loyalty/points"
import { redeemBlock, redeemCode, redeemKeyParts } from "../../../rules/loyalty/redeem"
import { configOf } from "../config-store"
import { LOYALTY_MANAGE, LOYALTY_VIEW } from "../constants"
import { loyaltyLedger, loyaltyMembers, loyaltyProgram, loyaltyRewards } from "../ports"
import { CONFLICT, refusedWith } from "../refusals"

const MAX_NOTE = 500
const MAX_REASON = 300
const AGENT = "NIVO"

/** The reads that show a customer's points, so every action that moves them refreshes the same ones. */
const POINT_READS = [
    "loyalty.member",
    "loyalty.member-ledger",
    "loyalty.member-rewards",
    "loyalty.members",
    "loyalty.member-counts",
    "loyalty.figures",
    "loyalty.stats",
    "loyalty.tiers",
] as const

const adjustInput: z.ZodObject<{
    id: z.ZodString
    points: z.ZodNumber
    reason: z.ZodString
    token: z.ZodOptional<z.ZodString>
}> = z.object({
    id: z.string().min(1).max(MAX_ID),
    points: z.number().min(-1e9).max(1e9),
    reason: z.string().max(MAX_REASON),
    token: z.string().min(1).max(MAX_ID).optional(),
})

/**
 * `loyalty.adjust-points`: adds or takes points by hand with the reason the owner gives; the person who corrects is on record.
 * The same token adjusts once.
 */
export const adjustPointsAction: ActionDefinition = defineAction({
    id: "loyalty.adjust-points",
    permission: LOYALTY_MANAGE,
    label: { key: "action_adjust_points" },
    input: adjustInput,
    ports: { members: loyaltyMembers, ledger: loyaltyLedger },
    transactional: true,
    run: async ({ members, ledger }, { id, points, reason, token }, context) => {
        const member = await members.get(id)
        if (member === null) return refusedWith("member_missing")
        const stamp = `${id}:${context.now.toISOString()}`
        const moved = Math.round(points)
        if (moved === 0) return refusedWith("points_required")
        if (reason.trim() === "") return refusedWith("reason_required")
        const entry = await ledger.post({
            customerId: member.id,
            kind: "adjust",
            points: moved,
            ref: `adjust:${token ?? stamp}`,
            by: context.memberId ?? AGENT,
            amountVnd: null,
            rewardId: null,
            evidence: reason.trim(),
            expiresAt: null,
            occurredAt: context.now.toISOString(),
        })
        return { ok: true, data: { posted: entry !== null } }
    },
    refreshes: POINT_READS,
    optimistic: false,
})

const updateInput: z.ZodObject<{
    id: z.ZodString
    name: z.ZodString
    birthday: z.ZodOptional<z.ZodNullable<z.ZodString>>
    note: z.ZodOptional<z.ZodString>
}> = z.object({
    id: z.string().min(1).max(MAX_ID),
    name: z.string().trim().min(1).max(MAX_LINE),
    birthday: z.string().max(10).nullable().optional(),
    note: z.string().max(MAX_NOTE).optional(),
})

/** `loyalty.update-member`: changes the name, the birthday and the note of a customer, never the identity or the balance. */
export const updateMemberAction: ActionDefinition = defineAction({
    id: "loyalty.update-member",
    permission: LOYALTY_MANAGE,
    label: { key: "action_update_member" },
    input: updateInput,
    ports: { members: loyaltyMembers },
    transactional: true,
    run: async ({ members }, { id, name, birthday, note }) => {
        const member = await members.get(id)
        if (member === null) return refusedWith("member_missing")
        const wanted = birthday === undefined || birthday === null || birthday === "" ? null : birthday
        const day = customerBirthday(wanted)
        if (wanted !== null && day === null) return refusedWith("birthday_invalid")
        const written = await members.update(id, member.version, {
            name,
            birthday: day,
            note: note ?? member.note,
        })
        if (written.ok) return { ok: true, data: { id: written.row.id } }
        return written.reason === "missing" ? refusedWith("member_missing") : CONFLICT
    },
    refreshes: ["loyalty.member", "loyalty.members"],
    optimistic: false,
})

const redeemInput: z.ZodObject<{ id: z.ZodString; token: z.ZodOptional<z.ZodString> }> = z.object({
    id: z.string().min(1).max(MAX_ID),
    token: z.string().min(1).max(MAX_ID).optional(),
})

/**
 * `loyalty.redeem-reward`: redeems a reward for a customer at the counter. The id names the customer and the reward (the id of
 * a row of `loyalty.member-rewards`). It is checked against the live balance, stock, limit and tier; the points and the stock move
 * in one transaction. The same token redeems once.
 */
export const redeemRewardAction: ActionDefinition = defineAction({
    id: "loyalty.redeem-reward",
    permission: LOYALTY_VIEW,
    label: { key: "action_redeem_reward" },
    input: redeemInput,
    ports: { members: loyaltyMembers, ledger: loyaltyLedger, rewards: loyaltyRewards, program: loyaltyProgram },
    transactional: true,
    run: async ({ members, ledger, rewards, program }, { id, token }, context) => {
        const parts = redeemKeyParts(id)
        if (parts === null) return refusedWith("redeem_key_invalid")
        const [member, reward] = await Promise.all([members.get(parts.memberId), rewards.get(parts.rewardId)])
        if (member === null) return refusedWith("member_missing")
        if (reward === null) return refusedWith("reward_missing")
        const stamp = `${id}:${context.now.toISOString()}`
        const ref = `redeem:${token ?? stamp}`
        const code = redeemCode(ref)
        if (await ledger.hasRef(ref)) return { ok: true, data: { code, posted: false } }
        const [config, counts] = await Promise.all([configOf(program), ledger.redeemedCounts(member.id)])
        const block = redeemBlock(config, reward, {
            points: member.points,
            tierKey: member.tierKey,
            redeemedBefore: counts[reward.id] ?? 0,
        })
        if (block !== null) return refusedWith(`not_redeemable_${block.code}`)
        const entry = await ledger.post({
            customerId: member.id,
            kind: "redeem",
            points: -reward.pointsCost,
            ref,
            by: context.memberId ?? AGENT,
            amountVnd: reward.valueVnd,
            rewardId: reward.id,
            evidence: `${reward.name} ${code}`,
            expiresAt: null,
            occurredAt: context.now.toISOString(),
        })
        if (entry !== null) await rewards.takeOne(reward.id)
        return { ok: true, data: { code, posted: entry !== null } }
    },
    refreshes: [...POINT_READS, "loyalty.rewards"],
    optimistic: false,
})

const purchaseInput: z.ZodObject<{
    phone: z.ZodString
    name: z.ZodOptional<z.ZodString>
    amountVnd: z.ZodNumber
    items: z.ZodOptional<z.ZodString>
    ref: z.ZodString
}> = z.object({
    phone: z.string().max(30),
    name: z.string().max(MAX_LINE).optional(),
    amountVnd: z.number().min(0).max(1e12),
    items: z.string().max(MAX_NOTE).optional(),
    ref: z.string().min(1).max(MAX_ID),
})

/**
 * `loyalty.record-purchase`: turns a sale into points on the ledger and lifts the customer to the tier their spend reaches. The
 * customer is found by phone and created when the phone is new; the same `ref` earns once.
 */
export const recordPurchaseAction: ActionDefinition = defineAction({
    id: "loyalty.record-purchase",
    permission: LOYALTY_MANAGE,
    label: { key: "action_record_purchase" },
    input: purchaseInput,
    ports: { members: loyaltyMembers, ledger: loyaltyLedger, program: loyaltyProgram },
    transactional: true,
    run: async ({ members, ledger, program }, { phone, name, amountVnd, items, ref }, context) => {
        const normalised = toLoyaltyPhone(phone)
        if (normalised === null) return refusedWith("phone_invalid")
        const config = await configOf(program)
        const member = await members.ensureByPhone(normalised, name?.trim() || normalised)
        const tier = tierByKey(config, member.tierKey) ?? tierFor(config, member.lifetimeSpendVnd)
        const calc = pointsFor(config, { amountVnd, items: items ?? "" }, tier)
        if (calc.points <= 0) return { ok: true, data: { status: "no_points", points: 0 } }
        const entry = await ledger.post({
            customerId: member.id,
            kind: "earn",
            points: calc.points,
            ref,
            by: context.memberId ?? AGENT,
            amountVnd: Math.round(amountVnd),
            rewardId: null,
            evidence: earnEvidence(calc),
            expiresAt: expiryDate(config, context.now.getTime()),
            occurredAt: context.now.toISOString(),
        })
        if (entry === null) return { ok: true, data: { status: "duplicate", points: 0 } }
        const fresh = await members.get(member.id)
        const earned = fresh === null ? null : tierFor(config, fresh.lifetimeSpendVnd)
        if (fresh !== null && earned !== null && tierRank(config, fresh.tierKey) < tierRank(config, earned.key))
            await members.update(fresh.id, fresh.version, { tierKey: earned.key })
        return { ok: true, data: { status: "done", points: calc.points } }
    },
    refreshes: POINT_READS,
    optimistic: false,
})
