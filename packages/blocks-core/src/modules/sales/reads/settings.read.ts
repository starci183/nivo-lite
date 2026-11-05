import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import type { SalesSettings } from "../../../rules/sales/settings"
import { SALES_VIEW } from "../constants"
import { salesSettings } from "../ports"
import { settingsOf } from "../settings-store"

const SETTINGS_FIELDS: ReadonlyArray<keyof SalesSettings> = [
    "approvalThresholdVnd",
    "draftWithoutTotalNeedsApproval",
    "closedDealsCanFlip",
    "reopenNeedsApproval",
]

/** `sales.settings`: the rules the workspace chose for its sales; the defaults before the first save. */
export const settingsRead: ReadDefinition = defineRead({
    id: "sales.settings",
    dataKind: "sales-settings",
    shape: "record",
    fields: SETTINGS_FIELDS,
    paths: {},
    variables: z.object({}),
    permission: SALES_VIEW,
    ports: { settings: salesSettings },
    run: ({ settings }): Promise<SalesSettings> => settingsOf(settings),
})
