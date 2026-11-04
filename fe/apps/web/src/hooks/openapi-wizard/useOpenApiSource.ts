"use client"

import { useCallback, useState } from "react"
import type { OpenApiOp } from "@/modules/openapi-spec"
import type { SetStateAction, Dispatch } from "react"

/** What a saved connection brings back to the spec step. */
export interface OpenApiSourceRestore {
    readonly name: string
    readonly specUrl: string
    readonly ops: ReadonlyArray<OpenApiOp>
    readonly hasSecret: boolean
}

type UseOpenApiSourceResult = {
    name: string
    specUrl: string
    specText: string
    ops: readonly {
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
    hasSecret: boolean
    ready: boolean
    unchanged: boolean
    setName: Dispatch<SetStateAction<string>>
    setSpecUrl: Dispatch<SetStateAction<string>>
    setSpecText: Dispatch<SetStateAction<string>>
    setOps: Dispatch<
        SetStateAction<
            readonly {
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
        >
    >
    restore: (saved: OpenApiSourceRestore) => void
    loaded: (next: ReadonlyArray<OpenApiOp>) => void
}

/** The spec half of the OpenAPI wizard: the connection name, the spec link or text, and the operations read from it. */
export const useOpenApiSource = (): UseOpenApiSourceResult => {
    const [name, setName] = useState("")
    const [specUrl, setSpecUrl] = useState("")
    const [specText, setSpecText] = useState("")
    const [loadedKey, setLoadedKey] = useState<string | null>(null)
    const [ops, setOps] = useState<ReadonlyArray<OpenApiOp>>([])
    const [hasSecret, setHasSecret] = useState(false)
    const key = `${specUrl.trim()}|${specText.length}`

    const restore = useCallback((saved: OpenApiSourceRestore): void => {
        setName(saved.name)
        setSpecUrl(saved.specUrl)
        setHasSecret(saved.hasSecret)
        setOps(saved.ops)
        setLoadedKey(`${saved.specUrl}|0`)
    }, [])

    /** The spec as typed now was read into these operations. */
    const loaded = (next: ReadonlyArray<OpenApiOp>): void => {
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
