"use client"

import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import type { ReadDefinition, ReadHandle, ReadVariables } from "../../block/block.types"
import type { SpecReadBinding } from "../../spec/spec.types"
import { variablesOf } from "../../spec/spec-value"
import { useWorkbenchHost } from "../host/WorkbenchHostProvider"
import { foldRead } from "./host-slot"

/** What a bound read takes. */
export interface BoundReadProps {
    readonly read: ReadDefinition
    readonly binding: SpecReadBinding
    readonly installationId: string
    /** `<node id>.<slot>`: where a defect is reported. */
    readonly at: string
    readonly children: (handle: ReadHandle) => ReactNode
}

/**
 * One read of one node: runs the host operation under the viewer rights, folds it into a slot of its own (loading, error with
 * retry, forbidden) and hands the block a handle. The block may set variables; they are kept here, per read.
 */
export const BoundRead = (props: BoundReadProps): ReactNode => {
    const host = useWorkbenchHost()
    const [chosen, setChosen] = useState<ReadVariables>({})
    const allowed = host.useCan(props.read.permission)
    const variables = { ...variablesOf(props.binding.variables, props.installationId), ...chosen }
    const read = host.useRead(props.read.operation, allowed ? variables : null)
    const folded = allowed
        ? foldRead(read, props.binding.path)
        : { slot: { isForbidden: true } as const, isDefect: false }
    const report = host.block.report
    useEffect(() => {
        if (folded.isDefect) report("READ_PATH_MISSING", props.at)
    }, [folded.isDefect, report, props.at])
    return props.children({
        slot: folded.slot,
        retry: read.reload,
        variables,
        setVariables: setChosen,
        page: read.page,
    })
}
