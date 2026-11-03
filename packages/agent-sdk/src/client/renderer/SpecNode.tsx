import type { ReactNode } from "react"
import type { ActionHandle, ReadHandle } from "../../block/block.types"
import type { PlanNode } from "../../spec/render-plan"
import { useWorkbenchHost } from "../host/WorkbenchHostProvider"
import { BoundAction } from "./BoundAction"
import { BoundRead } from "./BoundRead"
import { MISSING_READ, UNBOUND_ACTION, UNBOUND_READ } from "./inert"
import { NodeBoundary } from "./NodeBoundary"
import type { SpecContext } from "./renderer.types"

type SlotValue = ReadHandle | ActionHandle
type SlotValues = Readonly<Record<string, SlotValue>>

/** One slot of a block, with the id of the read or action a spec bound to it. */
interface SlotEntry {
    readonly name: string
    readonly kind: "read" | "action"
    readonly target: string | null
}

/** What the chain of slots of one node takes. */
interface SlotChainProps {
    readonly node: PlanNode
    readonly context: SpecContext
    readonly entries: ReadonlyArray<SlotEntry>
    readonly values: SlotValues
    readonly done: (values: SlotValues) => ReactNode
}

/** The slots of a node in declaration order, each with its binding. */
const slotEntries = (node: PlanNode): ReadonlyArray<SlotEntry> =>
    Object.entries(node.block.slots).map(([name, slot]): SlotEntry => {
        if (slot.kind === "read") return { name, kind: "read", target: node.reads[name]?.read ?? null }
        return { name, kind: "action", target: node.actions[name]?.action ?? null }
    })

/** Resolves the slots of a node one after the other, each in a component of its own so every hook list stays stable. */
const SlotChain = (props: SlotChainProps): ReactNode => {
    const [entry, ...rest] = props.entries
    if (entry === undefined) return props.done(props.values)
    const next = (value: SlotValue): ReactNode => (
        <SlotChain {...props} entries={rest} values={{ ...props.values, [entry.name]: value }} />
    )
    if (entry.kind === "read") {
        const read = props.context.reads.find((candidate) => candidate.id === entry.target)
        const binding = props.node.reads[entry.name]
        if (binding === undefined) return next(UNBOUND_READ)
        if (read === undefined) return next(MISSING_READ)
        return (
            <BoundRead
                read={read}
                binding={binding}
                installationId={props.context.installationId}
                at={`${props.node.id}.${entry.name}`}
            >
                {next}
            </BoundRead>
        )
    }
    const action = props.context.actions.find((candidate) => candidate.id === entry.target)
    if (action === undefined) return next(UNBOUND_ACTION)
    return (
        <BoundAction action={action} namespace={props.context.namespace}>
            {next}
        </BoundAction>
    )
}

/** Whether any read of the values is forbidden. */
const hasForbidden = (values: SlotValues): boolean =>
    Object.values(values).some((value) => "slot" in value && "isForbidden" in value.slot)

/** What a node takes. */
export interface SpecNodeProps {
    readonly node: PlanNode
    readonly context: SpecContext
}

/**
 * One node: not drawn when the viewer lacks its permission, resolved slot by slot, drawn by the block component inside a boundary
 * of its own so a crash stays in this place.
 */
export const SpecNode = (props: SpecNodeProps): ReactNode => {
    const host = useWorkbenchHost()
    const canSee = host.useCan(props.node.when?.permission ?? null)
    const text = host.block.text("blocks")
    const renderer = props.context.renderers.get(props.node.block.id)
    if (!canSee || renderer === undefined) return null
    const draw = (values: SlotValues): ReactNode =>
        props.node.forbidden === "hide" && hasForbidden(values) ? null : (
            <renderer.Component props={props.node.props} slots={values} nodeId={props.node.id}>
                {props.node.children.map((child) => (
                    <SpecNode key={child.id} node={child} context={props.context} />
                ))}
            </renderer.Component>
        )
    return (
        <NodeBoundary
            message={text({ key: "renderer.crashed" })}
            retryLabel={text({ key: "renderer.retry" })}
            onCrash={() => host.block.report("BLOCK_CRASHED", props.node.id)}
        >
            <SlotChain
                node={props.node}
                context={props.context}
                entries={slotEntries(props.node)}
                values={{}}
                done={draw}
            />
        </NodeBoundary>
    )
}
