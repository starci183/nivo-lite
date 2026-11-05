import { useEffect, useLayoutEffect, useState } from "react"
import type { ReactNode } from "react"
import type { ParamHandle, ReadDefinition, ReadHandle, ReadVariables } from "../../block/block.types"
import type { SpecReadBinding } from "../../spec/spec.types"
import { resolveVariables } from "../../spec/spec-value"
import type { HostRead } from "../../host/host.types"
import { useWorkbenchHost } from "../host/WorkbenchHostProvider"
import type { FoldedRead } from "./host-slot"
import { foldRead } from "./host-slot"
import { useViewGate } from "./ViewGate"
import { gatedSlot, isAnswered } from "./view-gate"

/** What a bound read takes. */
export interface BoundReadProps {
    readonly read: ReadDefinition
    readonly binding: SpecReadBinding
    readonly installationId: string
    /** The spec params, which fill the `$name` variables of the binding. */
    readonly params: ParamHandle
    /** `<node id>.<slot>`: where a defect is reported. */
    readonly at: string
    readonly children: (handle: ReadHandle) => ReactNode
}

/** The slot of a bound read: forbidden when the viewer lacks the permission, idle while a param it needs has no value, else the read's. */
const foldBound = (allowed: boolean, isWaiting: boolean, read: HostRead, path: string | undefined): FoldedRead => {
    if (!allowed) return { slot: { isForbidden: true }, isDefect: false }
    if (isWaiting) return { slot: { isEmpty: true }, isDefect: false }
    return foldRead(read, path)
}

/**
 * One read of one node: resolves the `$param` variables, runs the host operation under the viewer rights (not while a param it needs
 * has no value), folds it into a slot of its own (loading, error with retry, forbidden, idle) and hands the block a handle. The
 * block may set variables; they are kept here, per read. A list read hands its rows (path `rows`) unless the binding narrows it.
 * On the first load of the view every read draws its skeleton until all of them have answered once (the view gate).
 */
export const BoundRead = (props: BoundReadProps): ReactNode => {
    const host = useWorkbenchHost()
    const [chosen, setChosen] = useState<ReadVariables>({})
    const allowed = host.useCan(props.read.permission)
    const resolved = resolveVariables(props.binding.variables, props.installationId, props.params.value)
    const variables = { ...resolved.variables, ...chosen }
    const isWaiting = resolved.pending.some((name) => !Object.keys(chosen).includes(name))
    const isPaged = props.read.listing?.kind === "list"
    const read = host.useRead(props.read.operation, allowed && !isWaiting ? variables : null, { isPaged })
    const folded = foldBound(allowed, isWaiting, read, props.binding.path ?? (isPaged ? "rows" : undefined))
    const report = host.block.report
    useEffect(() => {
        if (folded.isDefect) report("READ_PATH_MISSING", props.at)
    }, [folded.isDefect, report, props.at])
    const gate = useViewGate()
    const answered = isAnswered(folded.slot)
    const { report: reportAnswer, forget } = gate
    useLayoutEffect(() => {
        reportAnswer(props.at, answered)
    }, [reportAnswer, props.at, answered])
    useLayoutEffect(() => () => forget(props.at), [forget, props.at])
    return props.children({
        slot: gatedSlot(gate.isGated, folded.slot),
        retry: read.reload,
        variables,
        setVariables: setChosen,
        page: read.page,
    })
}
