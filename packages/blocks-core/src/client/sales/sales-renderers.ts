import { defineRenderer } from "@nivo-lite/agent-sdk/client"
import type { BlockRenderer } from "@nivo-lite/agent-sdk/client"
import { salesAttentionCardBlock } from "../../blocks/sales/attention-card.block"
import { salesPipelineBlock } from "../../blocks/sales/pipeline.block"
import { AttentionCardBlock } from "./AttentionCardBlock"
import { PipelineBlock } from "./PipelineBlock"

/** The components of the Sales blocks, one per definition of `salesBlocks`. */
export const salesRenderers: ReadonlyArray<BlockRenderer> = [
    defineRenderer(salesAttentionCardBlock, AttentionCardBlock),
    defineRenderer(salesPipelineBlock, PipelineBlock),
]
