import type { ReactNode } from "react"
import type { BlockDefinition, BlockSlots, SlotValues } from "../../block/block.types"
import type { PropsSchema } from "../../schema/schema.types"
import type { z } from "zod"
import { RendererError } from "./renderer-error"

/** What a block component receives. */
export interface BlockRenderProps<P extends PropsSchema, S extends BlockSlots> {
    /** The literal props of the node, parsed by the block's zod schema. */
    readonly props: z.infer<P>
    /** The handle of each slot the block declares: a read handle per read slot, an action handle per action slot. */
    readonly slots: SlotValues<S>
    /** The drawn child nodes; null for a block that holds none. */
    readonly children: ReactNode
    /** The spec node id: a stable address for tests and the composer. */
    readonly nodeId: string
}

/** A block component: drawn only with Grammar components, through `SlotView` for every read status. */
export type BlockComponent<P extends PropsSchema, S extends BlockSlots> = (props: BlockRenderProps<P, S>) => ReactNode

/** What the renderer hands a registered component, before it is typed by its block. */
export interface ErasedRenderProps {
    /** The literal props of the node, not yet parsed. */
    readonly props: unknown
    /** The handle of each slot, not yet typed by the block. */
    readonly slots: Readonly<Record<string, unknown>>
    /** The drawn child nodes. */
    readonly children: ReactNode
    /** The id of the spec node. */
    readonly nodeId: string
}

/** A block with the component that draws it. */
export interface BlockRenderer {
    /** The id of the block, which a node names. */
    readonly id: BlockDefinition["id"]
    /** The definition the component draws. */
    readonly block: BlockDefinition
    /** The component, taking the node's props and slots before they are typed. */
    readonly Component: (props: ErasedRenderProps) => ReactNode
}

/** Whether the slots hold a handle for every slot the block declares. */
const holdsSlots = <S extends BlockSlots>(slots: ErasedRenderProps["slots"], declared: S): slots is SlotValues<S> =>
    Object.keys(declared).every((name) => name in slots)

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
    Component: (erased) => {
        if (!holdsSlots(erased.slots, block.slots)) throw new RendererError("RENDERER_SLOTS_MISSING", block.id)
        return Component({
            props: block.props.parse(erased.props),
            slots: erased.slots,
            children: erased.children,
            nodeId: erased.nodeId,
        })
    },
})
