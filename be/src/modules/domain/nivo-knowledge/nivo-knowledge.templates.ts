import { CORE_KNOWLEDGE } from "./core-knowledge.templates"
import type { NivoFile } from "./nivo-item.policy"

/**
 * Every base knowledge file NIVO ships: the `core` folder, about NIVO itself and the same for every shop, sorted by path. A module's
 * own working rules are its mindset in its package (`agentGuidanceOf`), never a file here.
 */
export const NIVO_KNOWLEDGE_FILES: ReadonlyArray<NivoFile> = [...CORE_KNOWLEDGE]
