import { defineAction } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { REMATCH_DAYS_MAX, REMATCH_DAYS_MIN, VAT_PERIODS, VOID_MODES } from "../../../rules/accounting/settings"
import { textOf } from "../messages/copy"
import { saveWorkspaceSettings, workspaceSettings } from "../accounting-data"
import { SETTINGS } from "../ports"

const flag: z.ZodOptional<z.ZodNullable<z.ZodBoolean>> = z.boolean().nullable().optional()

const input: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>
    postExpenses: typeof flag
    postOutgoing: typeof flag
    postUnmatched: typeof flag
    voidMode: z.ZodOptional<z.ZodNullable<z.ZodEnum<{ reversal: "reversal"; none: "none" }>>>
    vatPeriod: z.ZodOptional<z.ZodNullable<z.ZodEnum<{ monthly: "monthly"; quarterly: "quarterly" }>>>
    rematchDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>
}> = z.object({
    id: z.string().max(MAX_ID).optional(),
    postExpenses: flag,
    postOutgoing: flag,
    postUnmatched: flag,
    voidMode: z.enum(VOID_MODES).nullable().optional(),
    vatPeriod: z.enum(VAT_PERIODS).nullable().optional(),
    rematchDays: z.number().int().min(REMATCH_DAYS_MIN).max(REMATCH_DAYS_MAX).nullable().optional(),
})

/**
 * `accounting.save-settings`: saves the rules of the workspace's books. A value left empty keeps the saved one. The rules apply to
 * every entry posted from then on; the entries already in the books stay as they are.
 */
export const saveSettingsAction: ActionDefinition = defineAction({
    id: "accounting.save-settings",
    permission: "accounting.manage",
    label: textOf("save_settings"),
    input,
    ports: { settings: SETTINGS },
    transactional: true,
    refreshes: [
        "accounting.settings",
        "accounting.entries",
        "accounting.entry-counts",
        "accounting.status-counts",
        "accounting.weekly",
        "accounting.decisions",
        "accounting.figures",
    ],
    run: async ({ settings }, given) => {
        const saved = await workspaceSettings(settings)
        await saveWorkspaceSettings(settings, {
            postExpenses: given.postExpenses ?? saved.postExpenses,
            postOutgoing: given.postOutgoing ?? saved.postOutgoing,
            postUnmatched: given.postUnmatched ?? saved.postUnmatched,
            voidMode: given.voidMode ?? saved.voidMode,
            vatPeriod: given.vatPeriod ?? saved.vatPeriod,
            rematchDays: given.rematchDays ?? saved.rematchDays,
        })
        return { ok: true }
    },
})
