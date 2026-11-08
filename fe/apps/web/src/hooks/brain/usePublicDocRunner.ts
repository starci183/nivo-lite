"use client"

import { useRef, useState } from "react"
import { useTranslations } from "next-intl"
import {
    QUERY_BRAIN_SWR_KEY,
    QUERY_BRAIN_TODO_SWR_KEY,
    QUERY_KNOWLEDGE_SOURCES_SWR_KEY,
    QUERY_PUBLIC_DOCUMENTS_SWR_KEY,
} from "@/hooks/swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { mutate } from "@/modules/viewer-cache"
import { toast, useGraphQLWithToast } from "@/modules/toast"

/** The keys of the reads a public document changes: the list itself, the documents it was published as, and the customer questions it answers. */
const CHANGED_KEYS: ReadonlySet<string> = new Set([
    QUERY_PUBLIC_DOCUMENTS_SWR_KEY,
    QUERY_KNOWLEDGE_SOURCES_SWR_KEY,
    QUERY_BRAIN_SWR_KEY,
    QUERY_BRAIN_TODO_SWR_KEY,
])

/** Returns the actual saved snapshot; approval must never substitute a later polled revision. */
export type Run = <Result>(action: () => Promise<Result>, done: string | undefined) => Promise<Result | undefined>

/** The view `usePublicDocRunner` returns. */
export interface PublicDocRunnerView {
    isPending: boolean
    run: Run
}

/** The runner every command of the public documents goes through, and whether one is running. */
export const usePublicDocRunner = (): PublicDocRunnerView => {
    const runGraphQL = useGraphQLWithToast()
    const feedback = useTranslations("toast")
    const workspaceKey = useWorkspaceKey(QUERY_PUBLIC_DOCUMENTS_SWR_KEY, [])
    const running = useRef(false)
    const [isPending, setIsPending] = useState(false)
    const run: Run = async (action, done) => {
        if (running.current || workspaceKey === null) return undefined
        running.current = true
        setIsPending(true)
        try {
            const result = await runGraphQL(action, { successMessage: done, showSuccessToast: done !== undefined })
            if (result === undefined) return undefined
            await mutate(
                (key) =>
                    Array.isArray(key) &&
                    typeof key[0] === "string" &&
                    CHANGED_KEYS.has(key[0]) &&
                    key[1] === workspaceKey[1],
            )
            return result
        } catch {
            toast.danger(feedback("errorTitle"), { description: feedback("defaultError") })
            return undefined
        } finally {
            running.current = false
            setIsPending(false)
        }
    }
    return { isPending, run }
}
