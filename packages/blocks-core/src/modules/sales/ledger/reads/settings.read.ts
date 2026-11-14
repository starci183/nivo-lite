import { defineRead, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import type { AccountingSettings } from "../../../../rules/sales/ledger/settings"
import { workspaceSettings } from "../accounting-data"
import { SETTINGS } from "../ports"

const variables: z.ZodObject<Record<string, never>> = z.object({})

/** `blocks-core.sales.api.ledger-settings.get`: the rules the workspace chose for its books (the defaults before the first save). */
export const settingsRead: ReadDefinition = defineRead({
    id: "blocks-core.sales.api.ledger-settings.get",
    dataKind: "accounting-settings",
    shape: "record",
    fields: ["postExpenses", "postOutgoing", "postUnmatched", "voidMode", "vatPeriod", "rematchDays"],
    paths: {},
    variables,
    permission: "sales.view",
    ports: { settings: SETTINGS },
    run: ({ settings }): Promise<AccountingSettings> => workspaceSettings(settings),
})
