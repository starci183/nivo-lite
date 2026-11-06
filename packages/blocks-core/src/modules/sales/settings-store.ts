import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import { q } from "@nivo-lite/agent-sdk/query"
import { SALES_SETTINGS_KEY } from "../../entities/sales/settings.entity"
import { SALES_SETTINGS_DEFAULTS } from "../../rules/sales/settings"
import type { SalesSettings } from "../../rules/sales/settings"
import { SETTINGS_FIELDS, settingsRowOf } from "./sales-records"

/** The settings the workspace saved, else the defaults. */
export const settingsOf = async (settings: EntityApi): Promise<SalesSettings> => {
    const page = await settings.list({
        select: SETTINGS_FIELDS,
        where: q.eq("key", SALES_SETTINGS_KEY),
        order: [
            ["key", "asc"],
            ["id", "asc"],
        ],
        page: { size: 1 },
    })
    const first = page.rows[0]
    return (first === undefined ? null : settingsRowOf(first.row)) ?? SALES_SETTINGS_DEFAULTS
}

/** Saves the settings of the workspace as its one record; whether the engine took them. */
export const saveSettings = async (settings: EntityApi, saved: SalesSettings): Promise<boolean> =>
    (await settings.upsert("key_key", { key: SALES_SETTINGS_KEY, ...saved })).ok
