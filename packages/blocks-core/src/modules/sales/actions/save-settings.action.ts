import { defineAction } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { MAX_THRESHOLD_VND } from "../../../rules/sales/settings"
import { SALES_MANAGE } from "../constants"
import { salesSettings } from "../ports"
import { settingsOf } from "../settings-store"

const flag: z.ZodOptional<z.ZodNullable<z.ZodBoolean>> = z.boolean().nullable().optional()

const input: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>
    approvalThresholdVnd: z.ZodOptional<z.ZodNullable<z.ZodNumber>>
    draftWithoutTotalNeedsApproval: typeof flag
    closedDealsCanFlip: typeof flag
    reopenNeedsApproval: typeof flag
}> = z.object({
    id: z.string().max(MAX_ID).optional(),
    approvalThresholdVnd: z.number().min(0).max(MAX_THRESHOLD_VND).nullable().optional(),
    draftWithoutTotalNeedsApproval: flag,
    closedDealsCanFlip: flag,
    reopenNeedsApproval: flag,
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
        await settings.save({
            approvalThresholdVnd: given.approvalThresholdVnd ?? saved.approvalThresholdVnd,
            draftWithoutTotalNeedsApproval:
                given.draftWithoutTotalNeedsApproval ?? saved.draftWithoutTotalNeedsApproval,
            closedDealsCanFlip: given.closedDealsCanFlip ?? saved.closedDealsCanFlip,
            reopenNeedsApproval: given.reopenNeedsApproval ?? saved.reopenNeedsApproval,
        })
        return { ok: true }
    },
    refreshes: ["sales.settings", "sales.order", "sales.orders-waiting", "sales.orders", "sales.order-counts"],
})
