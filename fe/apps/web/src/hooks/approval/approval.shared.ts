import type { ModuleIconName } from "@/modules/types"
import { MODULE_REGISTRY } from "@/modules/catalog"

/** The glyph of the agent mark an approval card shows next to the drafting agent's name. */
export const approvalAgentGlyph = (): ModuleIconName => MODULE_REGISTRY.chatbot.glyph
