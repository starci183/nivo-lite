import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import { DEFAULT_CONFIG } from "../../../rules/sales/loyalty/config"
import type { LoyaltyConfig } from "../../../rules/sales/loyalty/config.types"
import type { ProgramRow } from "./loyalty.types"
import { programGet } from "./loyalty-catalogue-data"

/** The programme of a workspace that never saved one: switched off, with the starter rules. */
export const STARTER_PROGRAM: ProgramRow = { name: "", slug: "", enabled: false, config: DEFAULT_CONFIG, version: null }

/** The programme the workspace saved, else the starter one. */
export const programOf = async (program: EntityApi): Promise<ProgramRow> =>
    (await programGet(program)) ?? STARTER_PROGRAM

/** The rules the workspace saved, else the starter rules. */
export const configOf = async (program: EntityApi): Promise<LoyaltyConfig> => (await programOf(program)).config
