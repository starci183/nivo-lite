import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { settingsOf } from "../settings-store"
import { dueSoonOf } from "../../../rules/accounting/due-soon"
import type { DueItem } from "../../../rules/accounting/due-soon"
import { accountingSettingsPort } from "../ports"

const variables: z.ZodObject<Record<string, never>> = z.object({})

/** The tax declarations that fall due in the next 30 days. */
export interface DueSoonView {
    /** The obligations, soonest first. */
    readonly rows: ReadonlyArray<DueItem>
}

/** `accounting.due-soon`: the tax declarations that fall due within 30 days of now, with the days left on each; value added tax follows the filing period the workspace chose. */
export const dueSoonRead: ReadDefinition = defineRead({
    id: "accounting.due-soon",
    dataKind: "accounting-due-soon",
    shape: "record",
    fields: ["rows"],
    paths: { rows: "list" },
    variables,
    permission: "accounting.view",
    ports: { settings: accountingSettingsPort },
    run: async ({ settings }, _given, context): Promise<DueSoonView> => ({
        rows: dueSoonOf(context.now, (await settingsOf(settings)).vatPeriod),
    }),
})
