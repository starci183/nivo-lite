import { ACTION_KEYS, MODULE_KEYS } from "./catalog.keys"
import type { ActionKey, ModuleKey } from "./catalog.keys"

/** Whether a text is the key of a module of the catalogue. */
export const isModuleKey = (value: string | undefined | null): value is ModuleKey =>
    typeof value === "string" && MODULE_KEYS.some((key) => key === value)

/** Whether a text is the key of an authority action of the catalogue. */
export const isActionKey = (value: string | undefined | null): value is ActionKey =>
    typeof value === "string" && ACTION_KEYS.some((key) => key === value)
