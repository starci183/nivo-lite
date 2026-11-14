import { defineAction, type ActionDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { MAX_DISCOUNT_PCT, MAX_REMIND_DAYS, MAX_THRESHOLD_VND } from "../../../rules/sales/settings"
import { SALES_MANAGE } from "../constants"
import { salesSettings } from "../ports"
import { refusedWith } from "../refusals"
import { saveSettings, settingsOf } from "../settings-store"

const flag: z.ZodOptional<z.ZodNullable<z.ZodBoolean>> = z.boolean().nullable().optional()

const input: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>
    approvalThresholdVnd: z.ZodOptional<z.ZodNullable<z.ZodNumber>>
    draftWithoutTotalNeedsApproval: typeof flag
    closedDealsCanFlip: typeof flag
    reopenNeedsApproval: typeof flag
    maxDiscountPct: z.ZodOptional<z.ZodNullable<z.ZodNumber>>
    remindAfterDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>
    autoWon: typeof flag
    notifyAccounting: typeof flag
}> = z.object({
    id: z.string().max(MAX_ID).optional(),
    approvalThresholdVnd: z.number().int().min(0).max(MAX_THRESHOLD_VND).nullable().optional(),
    draftWithoutTotalNeedsApproval: flag,
    closedDealsCanFlip: flag,
    reopenNeedsApproval: flag,
    maxDiscountPct: z.number().int().min(0).max(MAX_DISCOUNT_PCT).nullable().optional(),
    remindAfterDays: z.number().int().min(1).max(MAX_REMIND_DAYS).nullable().optional(),
    autoWon: flag,
    notifyAccounting: flag,
})

/**
 * `sales.save-settings`: saves the rules of the workspace's sales. A value left empty keeps the saved one. From then on every
 * confirmation, move and waiting list reads the new rules.
 */
export const saveSettingsAction: ActionDefinition = defineAction({
    id: "sales.save-settings",
    permission: SALES_MANAGE,
    label: { key: "action_save_settings" },
    input,
    ports: { settings: salesSettings },
    transactional: true,
    run: async ({ settings }, given) => {
        const saved = await settingsOf(settings)
        const taken = await saveSettings(settings, {
            approvalThresholdVnd: given.approvalThresholdVnd ?? saved.approvalThresholdVnd,
            draftWithoutTotalNeedsApproval:
                given.draftWithoutTotalNeedsApproval ?? saved.draftWithoutTotalNeedsApproval,
            closedDealsCanFlip: given.closedDealsCanFlip ?? saved.closedDealsCanFlip,
            reopenNeedsApproval: given.reopenNeedsApproval ?? saved.reopenNeedsApproval,
            maxDiscountPct: given.maxDiscountPct ?? saved.maxDiscountPct,
            remindAfterDays: given.remindAfterDays ?? saved.remindAfterDays,
            autoWon: given.autoWon ?? saved.autoWon,
            notifyAccounting: given.notifyAccounting ?? saved.notifyAccounting,
        })
        return taken ? { ok: true } : refusedWith("settings_not_saved")
    },
    refreshes: ["blocks-core.sales.api.settings.get", "blocks-core.sales.api.order.get", "blocks-core.sales.api.order.waiting", "blocks-core.sales.api.order.list", "blocks-core.sales.api.order.counts"],
})
