import { Suspense } from "react"
import type { ReactElement, ReactNode } from "react"
import { EmptyNotice, Skeleton } from "@starci/grammar/common"
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
const SlotChain = (props: SlotChainProps): ReactElement => {
    const [entry, ...rest] = props.entries
    if (entry === undefined) return <>{props.done(props.values)}</>
    const next = (value: SlotValue): ReactElement => (
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
                params={props.context.params}
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
 * One node: not drawn when the viewer lacks its permission or the param it shows for holds another value, an "unavailable" notice when its block is not in the bundle, resolved
 * slot by slot, drawn by the block component inside a boundary of its own so a crash, or a component that fails to download, stays
 * in this place. The component of a lazy block loads under a Suspense of its own, while its reads already run.
 */
export const SpecNode = (props: SpecNodeProps): ReactNode => {
    const host = useWorkbenchHost()
    const canSee = host.useCan(props.node.when?.permission ?? null)
    const text = host.block.text("blocks")
    const renderer = props.context.renderers.get(props.node.block.id)
    if (!canSee) return null
    const showWhen = props.node.showWhen
    if (showWhen !== null && !showWhen.is.includes(props.context.params.value(showWhen.param) ?? "")) return null
    if (renderer === undefined) return <EmptyNotice message={text({ key: "renderer.unavailable" })} />
    const draw = (values: SlotValues): ReactNode =>
        props.node.forbidden === "hide" && hasForbidden(values) ? null : (
            <Suspense fallback={<Skeleton shape="text" lines={3} />}>
                <renderer.Component
                    props={props.node.props}
                    slots={values}
                    nodeId={props.node.id}
                    params={props.context.params}
                >
                    {props.node.children.map((child) => (
                        <SpecNode key={child.id} node={child} context={props.context} />
                    ))}
                </renderer.Component>
            </Suspense>
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
