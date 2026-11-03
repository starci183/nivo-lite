import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import type { BlockRenderProps } from "@nivo-lite/agent-sdk/client"

/** What the renderer hands the component of one block definition. */
export type RenderOf<D extends BlockDefinition> =
    D extends BlockDefinition<infer P, infer S> ? BlockRenderProps<P, S> : never
