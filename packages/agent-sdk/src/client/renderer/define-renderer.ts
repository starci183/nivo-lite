import type { ReactNode } from "react"
import type { BlockDefinition, BlockSlots, SlotValues } from "../../block/block.types"
import type { PropsSchema } from "../../schema/schema.types"
import type { z } from "zod"

/** What a block component receives. */
export interface BlockRenderProps<P extends PropsSchema, S extends BlockSlots> {
    readonly props: z.infer<P>
    readonly slots: SlotValues<S>
    readonly children: ReactNode
    /** The spec node id: a stable address for tests and the composer. */
    readonly nodeId: string
}

/** A block component: drawn only with Grammar components, through `SlotView` for every read status. */
export type BlockComponent<P extends PropsSchema, S extends BlockSlots> = (props: BlockRenderProps<P, S>) => ReactNode

/** What the renderer hands a registered component, before it is typed by its block. */
export interface ErasedRenderProps {
    readonly props: unknown
    readonly slots: Readonly<Record<string, unknown>>
    readonly children: ReactNode
    readonly nodeId: string
}

/** A block with the component that draws it. */
export interface BlockRenderer {
    readonly id: BlockDefinition["id"]
    readonly block: BlockDefinition
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
            slots: erased.slots as SlotValues<S>,
            children: erased.children,
            nodeId: erased.nodeId,
        }),
})
