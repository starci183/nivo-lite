import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import type { AccountingSettings } from "../../../rules/accounting/settings"
import { workspaceSettings } from "../accounting-data"
import { SETTINGS } from "../ports"

const variables: z.ZodObject<Record<string, never>> = z.object({})

/** `accounting.settings`: the rules the workspace chose for its books (the defaults before the first save). */
export const settingsRead: ReadDefinition = defineRead({
    id: "accounting.settings",
    dataKind: "accounting-settings",
    shape: "record",
    fields: ["postExpenses", "postOutgoing", "postUnmatched", "voidMode", "vatPeriod"],
    paths: {},
    variables,
    permission: "accounting.view",
    ports: { settings: SETTINGS },
    run: ({ settings }): Promise<AccountingSettings> => workspaceSettings(settings),
})
