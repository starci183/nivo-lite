import { MODULE_REGISTRY, isModuleKey } from "@/modules/catalog"

/** The glyph of an agent type; an unknown key falls back to the chatbot glyph. */
export const useModuleGlyph = (module: string): string =>
    isModuleKey(module) ? MODULE_REGISTRY[module].glyph : MODULE_REGISTRY.chatbot.glyph
