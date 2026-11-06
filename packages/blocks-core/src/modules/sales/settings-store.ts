import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import { q } from "@nivo-lite/agent-sdk/query"
import { SALES_SETTINGS_KEY } from "../../entities/sales/settings.entity"
import { SALES_SETTINGS_DEFAULTS } from "../../rules/sales/settings"
import type { SalesSettings } from "../../rules/sales/settings"
import { SETTINGS_FIELDS, settingsRowOf } from "./sales-records"

/** The settings of a workspace and the instant they were last saved. */
export interface SavedSettings {
    /** The rules in force. */
    readonly settings: SalesSettings
    /** When they were saved, ISO text; null before the first save. */
    readonly savedAt: string | null
}

/** The settings the workspace saved, with when they were saved; the defaults and no time before the first save. */
export const savedSettingsOf = async (settings: EntityApi): Promise<SavedSettings> => {
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
    const saved = first === undefined ? null : settingsRowOf(first.row)
    return saved === null || first === undefined
        ? { settings: SALES_SETTINGS_DEFAULTS, savedAt: null }
        : { settings: saved, savedAt: first.row.updatedAt }
}

/** The settings the workspace saved, else the defaults. */
export const settingsOf = async (settings: EntityApi): Promise<SalesSettings> =>
    (await savedSettingsOf(settings)).settings

/** Saves the settings of the workspace as its one record; whether the engine took them. */
export const saveSettings = async (settings: EntityApi, saved: SalesSettings): Promise<boolean> =>
    (await settings.upsert("key_key", { key: SALES_SETTINGS_KEY, ...saved })).ok
