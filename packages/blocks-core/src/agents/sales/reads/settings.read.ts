import { defineRead, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import type { SalesSettings } from "../rules/settings"
import { SALES_VIEW } from "../constants"
import { salesSettings } from "../ports"
import { savedSettingsOf } from "../settings-store"

/** What `blocks-core.sales.api.settings.get` answers: the rules and when they were saved. */
export interface SettingsView extends SalesSettings {
    /** When the rules were last saved, ISO text; null before the first save. */
    readonly savedAt: string | null
}

const SETTINGS_FIELDS: ReadonlyArray<keyof SalesSettings | "savedAt"> = [
    "approvalThresholdVnd",
    "draftWithoutTotalNeedsApproval",
    "closedDealsCanFlip",
    "reopenNeedsApproval",
    "maxDiscountPct",
    "remindAfterDays",
    "autoWon",
    "notifyAccounting",
    "savedAt",
]

/** `blocks-core.sales.api.settings.get`: the rules the workspace chose for its sales; the defaults before the first save. */
export const settingsRead: ReadDefinition = defineRead({
    id: "blocks-core.sales.api.settings.get",
    dataKind: "sales-settings",
    shape: "record",
    fields: SETTINGS_FIELDS,
    paths: {},
    variables: z.object({}),
    permission: SALES_VIEW,
    ports: { settings: salesSettings },
    run: async ({ settings }): Promise<SettingsView> => {
        const saved = await savedSettingsOf(settings)
        return { ...saved.settings, savedAt: saved.savedAt }
    },
})
