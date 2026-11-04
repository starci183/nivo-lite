import type { ReactNode } from "react"
import type { BlockDefinition, BlockSlots, SlotValues } from "../../block/block.types"
import type { PropsSchema } from "../../schema/schema.types"
import type { z } from "../../schema/zod.schema"
import { trusted } from "../../schema/trusted"

/** What a block component receives. */
export interface BlockRenderProps<P extends PropsSchema, S extends BlockSlots> {
    /** The node props, parsed by the block zod schema. */
    readonly props: z.infer<P>
    /** The block slots, each as the handle the host provides for it. */
    readonly slots: SlotValues<S>
    /** The drawn child nodes, placed where the component puts them. */
    readonly children: ReactNode
    /** The spec node id: a stable address for tests and the composer. */
    readonly nodeId: string
}

/** A block component: drawn only with Grammar components, through `SlotView` for every read status. */
export type BlockComponent<P extends PropsSchema, S extends BlockSlots> = (props: BlockRenderProps<P, S>) => ReactNode

/** What the renderer hands a registered component, before it is typed by its block. */
export interface ErasedRenderProps {
    /** The node props, not yet typed by the block. */
    readonly props: unknown
    /** The slot handles by slot key, not yet typed by the block. */
    readonly slots: Readonly<Record<string, unknown>>
    /** The drawn child nodes. */
    readonly children: ReactNode
    /** The spec node id, a stable address for tests and the composer. */
    readonly nodeId: string
}

/** A block with the component that draws it. */
export interface BlockRenderer {
    /** The id of the block the component draws. */
    readonly id: BlockDefinition["id"]
    /** The block definition the component draws. */
    readonly block: BlockDefinition
    /** The component that draws the block from untyped render props. */
    readonly Component: (props: ErasedRenderProps) => ReactNode
}

/**
 * Pairs a block with its component. The renderer parses the node props again with the block zod schema, so the component always
 * receives typed props; the slots are the ones the block declares.
 */
export const defineRenderer = <P extends PropsSchema, S extends BlockSlots>(
    block: BlockDefinition<P, S>,
    Component: BlockComponent<P, S>,
): BlockRenderer => ({
    id: block.id,
    block,
    Component: (erased) =>
        Component({
            props: block.props.parse(erased.props),
            slots: trusted<SlotValues<S>>(erased.slots),
            children: erased.children,
            nodeId: erased.nodeId,
        }),
})
