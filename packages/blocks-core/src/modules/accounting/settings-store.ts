import { ACCOUNTING_SETTINGS_DEFAULTS } from "../../rules/accounting/settings"
import type { AccountingSettings } from "../../rules/accounting/settings"
import type { SettingsStore } from "./accounting.types"

/** The settings the workspace saved, else the defaults. */
export const settingsOf = async (store: SettingsStore): Promise<AccountingSettings> =>
    (await store.get()) ?? ACCOUNTING_SETTINGS_DEFAULTS
