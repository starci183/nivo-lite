import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { loyaltyMembersBlock } from "./members.block"

/** The blocks of the Loyalty agent: its own views, written for Loyalty and named `loyalty.*`. */
export const loyaltyBlocks: ReadonlyArray<BlockDefinition> = [loyaltyMembersBlock]
