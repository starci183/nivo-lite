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
import type { ModuleKey } from "./catalog.keys"
import type { ModuleDef } from "./catalog.types"

export { MODULE_CATEGORIES } from "./catalog.categories"
export { ACTION_KEYS, MODULE_KEYS } from "./catalog.keys"
export type { ActionKey, ModuleCategoryKey, ModuleKey } from "./catalog.keys"
export { REGISTRY_ACTION_LABELS, REGISTRY_DEPT_LABELS, REGISTRY_MODULE_LABELS } from "./catalog.labels"
export type {
    Bilingual,
    BilingualList,
    GateWrite,
    ModuleAudience,
    ModuleCategory,
    ModuleDef,
    ModuleStatus,
    RegistryAction,
    RegistryCommand,
    RegistryGate,
} from "./catalog.types"

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
