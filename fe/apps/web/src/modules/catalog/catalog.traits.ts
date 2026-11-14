import { MODULE_REGISTRY } from "./catalog.registry"
import type { ModuleKey } from "./catalog.keys"

/** The internal agents: they never talk to customers, so their section has no "answer customers" switch. */
const INTERNAL_MODULES: ReadonlySet<string> = new Set(["sales"])

/** Whether an agent of this type answers customers (every type but the internal ones). */
export const answersCustomersOf = (module: ModuleKey): boolean => !INTERNAL_MODULES.has(module)

/** Whether the general settings of this type carry the reply limits of the chatbot. */
export const hasReplyLimitsOf = (module: ModuleKey): boolean => MODULE_REGISTRY[module].settingsExtras === "chatbot_reply"
