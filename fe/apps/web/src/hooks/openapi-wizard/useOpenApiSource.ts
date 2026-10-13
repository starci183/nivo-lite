"use client"

import { useCallback, useState } from "react"
import type { OpenApiOp } from "./openapi-wizard.shared"

/** What a saved connection brings back to the spec step. */
interface OpenApiSourceRestore {
    readonly name: string
    readonly specUrl: string
    readonly ops: ReadonlyArray<OpenApiOp>
    readonly hasSecret: boolean
}

/** The spec half of the OpenAPI wizard: the connection name, the spec link or text, and the operations read from it. */
export const useOpenApiSource = () => {
    const [name, setName] = useState("")
    const [specUrl, setSpecUrl] = useState("")
    const [specText, setSpecText] = useState("")
    const [loadedKey, setLoadedKey] = useState<string | null>(null)
    const [ops, setOps] = useState<ReadonlyArray<OpenApiOp>>([])
    const [hasSecret, setHasSecret] = useState(false)
    const key = `${specUrl.trim()}|${specText.length}`

    const restore = useCallback((saved: OpenApiSourceRestore) => {
        setName(saved.name)
        setSpecUrl(saved.specUrl)
        setHasSecret(saved.hasSecret)
        setOps(saved.ops)
        setLoadedKey(`${saved.specUrl}|0`)
    }, [])

    /** The spec as typed now was read into these operations. */
    const loaded = (next: ReadonlyArray<OpenApiOp>) => {
        setOps(next)
        setLoadedKey(key)
    }

    return {
        name,
        specUrl,
        specText,
        ops,
        hasSecret,
        ready: specUrl.trim() !== "" || specText.trim() !== "",
        unchanged: loadedKey === key && ops.length > 0,
        setName,
        setSpecUrl,
        setSpecText,
        setOps,
        restore,
        loaded,
    }
}
