import { defineRenderer } from "@nivo-lite/agent-sdk/client"
import type { BlockRenderer } from "@nivo-lite/agent-sdk/client"
import { loyaltyMembersBlock } from "../../blocks/loyalty/members.block"
import { MembersBlock } from "./MembersBlock"

/** The components of the Loyalty blocks, one per definition of `loyaltyBlocks`. */
export const loyaltyRenderers: ReadonlyArray<BlockRenderer> = [defineRenderer(loyaltyMembersBlock, MembersBlock)]
