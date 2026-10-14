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
import { ACTION_KEYS, MODULE_KEYS } from "./catalog.keys"
import type { ActionKey, ModuleKey } from "./catalog.keys"
import type { ModuleDef, RegistryAction } from "./catalog.types"

/** The routing, visuals and behavior of every module by key. */
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

/** Whether every authority action has been given the module that owns it. */
const isCompleteActionModule = (value: Partial<Record<ActionKey, ModuleKey>>): value is Record<ActionKey, ModuleKey> =>
    ACTION_KEYS.every((action) => value[action] !== undefined)

/** Which module owns each authority action, read from the catalogue. */
const actionModuleOfRegistry = (): Readonly<Record<ActionKey, ModuleKey>> => {
    const owner: Partial<Record<ActionKey, ModuleKey>> = {}
    for (const key of MODULE_KEYS) {
        for (const entry of MODULE_REGISTRY[key].authorityActions) owner[entry.action] = key
    }
    if (!isCompleteActionModule(owner)) throw new Error("catalogue action is missing its module")
    return owner
}

/** Which module owns each authority action (its department). */
export const ACTION_MODULE: Readonly<Record<ActionKey, ModuleKey>> = actionModuleOfRegistry()

/** The definition of an authority action; throws for a key that is not in the catalogue. */
export const actionDef = (action: ActionKey): RegistryAction => {
    const found = MODULE_REGISTRY[ACTION_MODULE[action]].authorityActions.find((a) => a.action === action)
    if (!found) throw new Error(`unknown action ${action}`)
    return found
}
