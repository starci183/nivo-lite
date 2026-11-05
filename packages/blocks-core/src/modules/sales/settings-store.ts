import { SALES_SETTINGS_DEFAULTS } from "../../rules/sales/settings"
import type { SalesSettings } from "../../rules/sales/settings"
import type { SettingsStore } from "./ports"

/** The settings the workspace saved, else the defaults. */
export const settingsOf = async (store: SettingsStore): Promise<SalesSettings> =>
    (await store.get()) ?? SALES_SETTINGS_DEFAULTS
