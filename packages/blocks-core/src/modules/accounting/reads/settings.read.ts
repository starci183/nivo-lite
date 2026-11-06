import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import type { AccountingSettings } from "../../../rules/accounting/settings"
import { accountingSettingsPort } from "../ports"
import { settingsOf } from "../settings-store"

/** `accounting.settings`: the rules the workspace chose for its books; the defaults before the first save. */
export const settingsRead: ReadDefinition = defineRead({
    id: "accounting.settings",
    dataKind: "accounting-settings",
    shape: "record",
    fields: ["postExpenses", "postOutgoing", "postUnmatched", "voidMode", "vatPeriod"],
    paths: {},
    variables: z.object({}),
    permission: "accounting.view",
    ports: { settings: accountingSettingsPort },
    run: ({ settings }): Promise<AccountingSettings> => settingsOf(settings),
})
