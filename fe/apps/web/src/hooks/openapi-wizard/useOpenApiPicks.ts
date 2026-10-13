"use client"

import { useCallback, useMemo, useState } from "react"
import { matchesOpenApiOp, newOpenApiPull, OPEN_API_SHOWN, openApiEntityOf } from "./openapi-wizard.shared"
import type { OpenApiOp, OpenApiPullDef, OpenApiPullField } from "./openapi-wizard.shared"

/** What a saved connection brings back to the pull, tool and schedule steps. */
interface OpenApiPicksRestore {
    readonly pulls: ReadonlyArray<OpenApiPullDef>
    readonly tools: ReadonlyArray<string>
    readonly schedule: string
}

/** The operations the owner picked: the GETs pulled on a schedule, the operations agents may call, and how often to pull. */
export const useOpenApiPicks = (ops: ReadonlyArray<OpenApiOp>) => {
    const [pulls, setPulls] = useState<ReadonlyArray<OpenApiPullDef>>([])
    const [tools, setTools] = useState<ReadonlyArray<string>>([])
    const [schedule, setSchedule] = useState<string>("manual")
    const [pullQuery, setPullQuery] = useState("")
    const [toolQuery, setToolQuery] = useState("")
    const gets = useMemo(
        () => ops.filter((op) => op.method === "GET" && matchesOpenApiOp(op, pullQuery)),
        [ops, pullQuery],
    )
    const visibleTools = useMemo(
        () => ops.filter((op) => matchesOpenApiOp(op, toolQuery)).slice(0, OPEN_API_SHOWN),
        [ops, toolQuery],
    )
    const visibleIds = new Set(visibleTools.map((op) => op.id))

    /** Sets (or with null drops) the pull of an operation. */
    const onPull = (op: OpenApiOp, pull: OpenApiPullDef | null) =>
        setPulls((list) => {
            const others = list.filter((item) => item.opId !== op.id)
            return pull === null ? others : [...others, pull]
        })

    const togglePull = (opId: string, on: boolean) => {
        const op = ops.find((item) => item.id === opId)
        if (op !== undefined) onPull(op, on ? newOpenApiPull(op) : null)
    }

    const patchPull = (opId: string, field: OpenApiPullField, value: string | null) => {
        const op = ops.find((item) => item.id === opId)
        const pull = pulls.find((item) => item.opId === opId)
        if (op === undefined || pull === undefined) return
        if (field !== "entity") return onPull(op, { ...pull, [field]: value ?? "" })
        const entity = openApiEntityOf(value)
        if (entity !== undefined) onPull(op, { ...pull, entity })
    }

    /** Keeps only the picks whose operation is still in the spec. */
    const keepOnly = (ids: ReadonlySet<string>) => {
        setPulls((list) => list.filter((item) => ids.has(item.opId)))
        setTools((list) => list.filter((id) => ids.has(id)))
    }

    const restore = useCallback((saved: OpenApiPicksRestore) => {
        setPulls(saved.pulls)
        setTools(saved.tools)
        setSchedule(saved.schedule)
    }, [])

    return {
        pulls,
        tools,
        schedule,
        pullQuery,
        toolQuery,
        gets: gets.slice(0, OPEN_API_SHOWN),
        noGets: gets.length === 0,
        tooMany: gets.length > OPEN_API_SHOWN,
        visibleTools,
        toolValue: tools.filter((id) => visibleIds.has(id)),
        onPull,
        togglePull,
        patchPull,
        keepOnly,
        restore,
        setSchedule: (id: string | null) => {
            if (id !== null && id !== "") setSchedule(id)
        },
        setPullQuery,
        setToolQuery,
        pickTools: (ids: ReadonlyArray<string>) => setTools([...tools.filter((id) => !visibleIds.has(id)), ...ids]),
    }
}
