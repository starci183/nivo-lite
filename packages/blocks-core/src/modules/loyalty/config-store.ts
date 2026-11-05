import { DEFAULT_CONFIG } from "../../rules/loyalty/config"
import type { LoyaltyConfig } from "../../rules/loyalty/config.types"
import type { ProgramRow } from "./loyalty.types"
import type { ProgramStore } from "./ports"

/** The programme of a workspace that never saved one: switched off, with the starter rules. */
export const STARTER_PROGRAM: ProgramRow = { name: "", slug: "", enabled: false, config: DEFAULT_CONFIG, version: null }

/** The programme the workspace saved, else the starter one. */
export const programOf = async (store: ProgramStore): Promise<ProgramRow> => (await store.get()) ?? STARTER_PROGRAM

/** The rules the workspace saved, else the starter rules. */
export const configOf = async (store: ProgramStore): Promise<LoyaltyConfig> => (await programOf(store)).config
