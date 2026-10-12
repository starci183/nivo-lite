export { MODULE_CATEGORIES } from "./catalog.categories"
export { ACTION_KEYS, MODULE_KEYS } from "./catalog.keys"
export { isActionKey, isModuleKey } from "./catalog.guards"
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
export { MODULE_REGISTRY } from "./catalog.registry"
export { agentTypeName, pickCopy, pickCopyList } from "./catalog.copy"
export type { CopyLocale } from "./catalog.copy"
