"use client"

import { useCallback, useMemo, useState, type SetStateAction, type Dispatch } from "react"
import {
    matchesOpenApiOp,
    newOpenApiPull,
    OPEN_API_SHOWN,
    openApiEntityOf,
    type OpenApiOp,
    type OpenApiPullDef,
    type OpenApiPullField,
} from "@/modules/openapi-spec"

/** What a saved connection brings back to the pull, tool and schedule steps. */
export interface OpenApiPicksRestore {
    readonly pulls: ReadonlyArray<OpenApiPullDef>
    readonly tools: ReadonlyArray<string>
    readonly schedule: string
}

type UseOpenApiPicksResult = {
    pulls: readonly {
        opId: string
        entity: "customer" | "order" | "product" | "transaction" | "other"
        itemsPath: string
        idField: string
        titleField: string
        fixedQuery: string
    }[]
    tools: readonly string[]
    schedule: string
    pullQuery: string
    toolQuery: string
    gets: {
        id: string
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
        path: string
        summary: string
        params: {
            name: string
            in: "header" | "query" | "path"
            required: boolean
        }[]
        hasBody: boolean
        suggest?:
            | {
                  itemsPath: string
                  idField: string
                  titleField: string
              }
            | undefined
    }[]
    noGets: boolean
    tooMany: boolean
    visibleTools: {
        id: string
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
        path: string
        summary: string
        params: {
            name: string
            in: "header" | "query" | "path"
            required: boolean
        }[]
        hasBody: boolean
        suggest?:
            | {
                  itemsPath: string
                  idField: string
                  titleField: string
              }
            | undefined
    }[]
    toolValue: string[]
    onPull: (op: OpenApiOp, pull: OpenApiPullDef | null) => void
    togglePull: (opId: string, on: boolean) => void
    patchPull: (opId: string, field: OpenApiPullField, value: string | null) => void
    keepOnly: (ids: ReadonlySet<string>) => void
    restore: (saved: OpenApiPicksRestore) => void
    setSchedule: (id: string | null) => void
    setPullQuery: Dispatch<SetStateAction<string>>
    setToolQuery: Dispatch<SetStateAction<string>>
    pickTools: (ids: ReadonlyArray<string>) => void
}

/** The operations the owner picked: the GETs pulled on a schedule, the operations agents may call, and how often to pull. */
export const useOpenApiPicks = (ops: ReadonlyArray<OpenApiOp>): UseOpenApiPicksResult => {
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
    const onPull = (op: OpenApiOp, pull: OpenApiPullDef | null): void =>
        setPulls((list) => {
            const others = list.filter((item) => item.opId !== op.id)
            return pull === null ? others : [...others, pull]
        })

    const togglePull = (opId: string, on: boolean): void => {
        const op = ops.find((item) => item.id === opId)
        if (op !== undefined) onPull(op, on ? newOpenApiPull(op) : null)
    }

    const patchPull = (opId: string, field: OpenApiPullField, value: string | null): void => {
        const op = ops.find((item) => item.id === opId)
        const pull = pulls.find((item) => item.opId === opId)
        if (op === undefined || pull === undefined) return
        if (field !== "entity") return onPull(op, { ...pull, [field]: value ?? "" })
        const entity = openApiEntityOf(value)
        if (entity !== undefined) onPull(op, { ...pull, entity })
    }

    /** Keeps only the picks whose operation is still in the spec. */
    const keepOnly = (ids: ReadonlySet<string>): void => {
        setPulls((list) => list.filter((item) => ids.has(item.opId)))
        setTools((list) => list.filter((id) => ids.has(id)))
    }

    const restore = useCallback((saved: OpenApiPicksRestore): void => {
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
        setSchedule: (id: string | null): void => {
            if (id !== null && id !== "") setSchedule(id)
        },
        setPullQuery,
        setToolQuery,
        pickTools: (ids: ReadonlyArray<string>): void =>
            setTools([...tools.filter((id) => !visibleIds.has(id)), ...ids]),
    }
}
