import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { salesAttentionCardBlock } from "./attention-card.block"
import { salesPipelineBlock } from "./pipeline.block"

/** The blocks of the Sales agent: its own views, written for Sales and named `sales.*`. */
export const salesBlocks: ReadonlyArray<BlockDefinition> = [salesAttentionCardBlock, salesPipelineBlock]
