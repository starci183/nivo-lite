"use client"

import { useState, type ClipboardEvent } from "react"
import { linkProblemOf, nextId, splitLinks, type LinkInput } from "@/modules/documents"
import type { LinkRows } from "@/hooks/knowledgeAddTypes"

const newRow = (value = ""): LinkInput => ({ id: nextId(), value })

/** The list of link inputs of the Add documents drawer: one input per link, a paste of several links fills several rows. */
export const useLinkRows = (): LinkRows => {
    const [rows, setRows] = useState<ReadonlyArray<LinkInput>>(() => [newRow()])
    const [errors, setErrors] = useState<Readonly<Record<string, string>>>({})
    const dropError = (id: string) =>
        setErrors((now) => Object.fromEntries(Object.entries(now).filter(([key]) => key !== id)))
    const setValue = (id: string, value: string) => {
        setRows((now) => now.map((row) => (row.id === id ? { ...row, value } : row)))
        dropError(id)
    }
    const validate = (id: string) => {
        const problem = linkProblemOf(rows.find((row) => row.id === id)?.value ?? "")
        if (problem === null) dropError(id)
        else setErrors((now) => ({ ...now, [id]: problem }))
    }
    const remove = (id: string) => {
        setRows((now) => (now.length > 1 ? now.filter((row) => row.id !== id) : [newRow()]))
        dropError(id)
    }
    const paste = (id: string, event: ClipboardEvent<HTMLInputElement>) => {
        const urls = splitLinks(event.clipboardData.getData("text"))
        if (urls.length < 2) return
        event.preventDefault()
        setRows((now) => {
            const at = now.findIndex((row) => row.id === id)
            const here = now[at]
            if (here === undefined) return now
            const others = new Set(now.filter((row) => row.id !== id).map((row) => row.value.trim()))
            const added = urls.filter((url) => !others.has(url)).map((url) => newRow(url))
            const kept = here.value.trim() === "" ? [] : [here]
            return [...now.slice(0, at), ...kept, ...added, ...now.slice(at + 1)]
        })
        dropError(id)
    }
    return {
        rows,
        errors,
        links: rows.map((row) => row.value).join("\n"),
        setValue,
        add: () => setRows((now) => [...now, newRow()]),
        remove,
        validate,
        paste,
        clear: () => {
            setRows([newRow()])
            setErrors({})
        },
    }
}
