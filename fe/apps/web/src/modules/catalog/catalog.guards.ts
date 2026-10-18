import { ACTION_KEYS, MODULE_KEYS } from "./catalog.keys"
import type { ActionKey, ModuleKey } from "./catalog.keys"

const MODULE_KEY_SET: ReadonlySet<string> = new Set(MODULE_KEYS)
const ACTION_KEY_SET: ReadonlySet<string> = new Set(ACTION_KEYS)

/** Whether a text is the key of a module of the catalogue. */
export const isModuleKey = (value: string | undefined | null): value is ModuleKey =>
    typeof value === "string" && MODULE_KEY_SET.has(value)

/** Whether a text is the key of an authority action of the catalogue. */
export const isActionKey = (value: string | undefined | null): value is ActionKey =>
    typeof value === "string" && ACTION_KEY_SET.has(value)
