import { defineAction } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_LINE } from "../../../bounds"
import { resolveConfig } from "../../../rules/loyalty/config"
import { programSlug } from "../../../rules/loyalty/slug"
import { programOf } from "../config-store"
import { LOYALTY_MANAGE } from "../constants"
import { programSave } from "../loyalty-catalogue-data"
import { syncMembers } from "../loyalty-member-data"
import { LEADS, MEMBERS, PROGRAM } from "../ports"
import { CONFLICT } from "../refusals"
import { hostRecordId } from "./record-id"

const number: z.ZodOptional<z.ZodNullable<z.ZodNumber>> = z.number().min(-1e13).max(1e13).nullable().optional()
const text: z.ZodOptional<z.ZodNullable<z.ZodString>> = z.string().max(MAX_LINE).nullable().optional()
const flag: z.ZodOptional<z.ZodNullable<z.ZodBoolean>> = z.boolean().nullable().optional()

const saveInput: z.ZodObject<{
    id: typeof hostRecordId
    name: z.ZodString
    enabled: typeof flag
    perThousandVnd: typeof number
    perVisit: typeof number
    minOrderVnd: typeof number
    trigger: typeof text
    expiryMonths: typeof number
    warnDays: typeof number
    birthdayOn: typeof flag
    birthdayPoints: typeof number
    birthdayReward: typeof text
    birthdayNote: typeof text
    maxPerMonth: typeof number
    hourFrom: typeof text
    hourTo: typeof text
    batch: typeof number
}> = z.object({
    id: hostRecordId,
    name: z.string().trim().min(1).max(MAX_LINE),
    enabled: flag,
    perThousandVnd: number,
    perVisit: number,
    minOrderVnd: number,
    trigger: text,
    expiryMonths: number,
    warnDays: number,
    birthdayOn: flag,
    birthdayPoints: number,
    birthdayReward: text,
    birthdayNote: text,
    maxPerMonth: number,
    hourFrom: text,
    hourTo: text,
    batch: number,
})

/**
 * `loyalty.save-program`: saves the name, the switch and the rules of the programme. A value left empty keeps the saved one, and
 * every number is clamped by the rules; the tier ladder and the category rates stay as saved. The first save makes the public slug
 * from the name.
 */
export const saveProgramAction: ActionDefinition = defineAction({
    id: "loyalty.save-program",
    permission: LOYALTY_MANAGE,
    label: { key: "action_save_program" },
    input: saveInput,
    ports: { program: PROGRAM },
    transactional: true,
    run: async ({ program }, input) => {
        const saved = await programOf(program)
        const { earn, tiers, expiry, birthday, promo } = saved.config
        const config = resolveConfig({
            earn: {
                ...earn,
                perThousandVnd: input.perThousandVnd ?? earn.perThousandVnd,
                perVisit: input.perVisit ?? earn.perVisit,
                minOrderVnd: input.minOrderVnd ?? earn.minOrderVnd,
                trigger: input.trigger ?? earn.trigger,
            },
            tiers,
            expiry: {
                months: input.expiryMonths ?? expiry.months,
                warnDays: input.warnDays ?? expiry.warnDays,
            },
            birthday: {
                enabled: input.birthdayOn ?? birthday.enabled,
                points: input.birthdayPoints ?? birthday.points,
                rewardKey: input.birthdayReward ?? birthday.rewardKey,
                note: input.birthdayNote ?? birthday.note,
            },
            promo: {
                maxPerMonth: input.maxPerMonth ?? promo.maxPerMonth,
                hourFrom: input.hourFrom ?? promo.hourFrom,
                hourTo: input.hourTo ?? promo.hourTo,
                batch: input.batch ?? promo.batch,
            },
        })
        const written = await programSave(program, {
            name: input.name,
            slug: saved.slug === "" ? programSlug(input.name) : saved.slug,
            enabled: input.enabled ?? saved.enabled,
            config,
        })
        return written === null ? CONFLICT : { ok: true, data: { slug: written.slug } }
    },
    refreshes: ["loyalty.program", "loyalty.tiers", "loyalty.stats"],
    optimistic: false,
})

/** `loyalty.sync-members`: makes a customer of every lead that has a phone or an email and links the leads and their chats to them. */
export const syncMembersAction: ActionDefinition = defineAction({
    id: "loyalty.sync-members",
    permission: LOYALTY_MANAGE,
    label: { key: "action_sync_members" },
    input: z.object({ id: hostRecordId }),
    ports: { members: MEMBERS, leads: LEADS },
    transactional: true,
    run: async ({ members, leads }) => {
        const synced = await syncMembers(members, leads)
        return { ok: true, data: { created: synced.created, linked: synced.linked } }
    },
    refreshes: ["loyalty.members", "loyalty.member-counts", "loyalty.figures", "loyalty.stats", "loyalty.tiers"],
    optimistic: false,
})
