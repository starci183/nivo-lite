import { CHATBOT } from "./chatbot"
import { LEAD_GEN } from "./lead-gen"
import { SALES } from "./sales"
import { ACCOUNTING } from "./accounting"
import { SHIFTS } from "./shifts"
import { BOOKING } from "./booking"
import { INVENTORY } from "./inventory"
import { LOYALTY } from "./loyalty"
import { VIDEO } from "./video"
import { CONTENT } from "./content"
import { HIRING } from "./hiring"
import { MODULE_KEYS } from "./catalog.keys"
import type { ActionKey, ModuleKey } from "./catalog.keys"
import type { ModuleDef, RegistryAction } from "./catalog.types"

/** Every module of the catalogue by key. */
export const MODULE_REGISTRY: Readonly<Record<ModuleKey, ModuleDef>> = {
    chatbot: CHATBOT,
    lead_gen: LEAD_GEN,
    sales: SALES,
    accounting: ACCOUNTING,
    shifts: SHIFTS,
    booking: BOOKING,
    inventory: INVENTORY,
    loyalty: LOYALTY,
    video: VIDEO,
    content: CONTENT,
    hiring: HIRING,
}

/** Which module owns each authority action (its department). */
export const ACTION_MODULE: Readonly<Record<ActionKey, ModuleKey>> = Object.fromEntries(
    MODULE_KEYS.flatMap((key) => MODULE_REGISTRY[key].authorityActions.map((a) => [a.action, key] as const)),
) as Record<ActionKey, ModuleKey>

/** The definition of an authority action; throws for a key that is not in the catalogue. */
export const actionDef = (action: ActionKey): RegistryAction => {
    const found = MODULE_REGISTRY[ACTION_MODULE[action]].authorityActions.find((a) => a.action === action)
    if (!found) throw new Error(`unknown action ${action}`)
    return found
}
