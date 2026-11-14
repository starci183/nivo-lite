import type { ModuleMessages } from "../modules/module-messages.types"
import en from "./messages/en.json"
import vi from "./messages/vi.json"

/** The messages of the platform module in both product languages: it draws no words of its own, the agent page frame does. */
export const PLATFORM_MESSAGES: ModuleMessages = { vi, en }
