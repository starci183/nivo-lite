"use client"

import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import { mutate } from "swr"
import { QUERY_HIRING_CANDIDATE_DETAIL_SWR_KEY, QUERY_HIRING_WORKBENCH_SWR_KEY } from "@/hooks/swr"
import { toast, useGraphQLWithToast } from "@/modules/toast"

/** What one command run leaves on the screen. */
export interface HiringRun {
    /**
     * Runs a command. On success the notice is the text `describe` returns, the workbench and the candidate detail are
     * revalidated and the value is answered; on failure the back end sentence is toasted and `undefined` is answered.
     */
    readonly exec: <T>(command: () => Promise<T>, describe?: (value: T) => string | undefined) => Promise<T | undefined>
    readonly isPending: boolean
    /** The generic failure line; the back end sentence is already toasted. */
    readonly error: string | null
    readonly notice: string | null
    /** Clears the error and the notice. */
    readonly clear: () => void
}

const isDetailKey = (key: unknown): boolean => Array.isArray(key) && key[0] === QUERY_HIRING_CANDIDATE_DETAIL_SWR_KEY

/** Runs the commands of the Hiring screens with a pending flag, one error line, one notice, toasts and a read refresh. */
export const useHiringRun = (): HiringRun => {
    const t = useTranslations("toast")
    const runGraphQL = useGraphQLWithToast()
    const [isPending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const clear = useCallback(() => {
        setError(null)
        setNotice(null)
    }, [])
    const exec = useCallback<HiringRun["exec"]>(
        async (command, describe) => {
            clear()
            setPending(true)
            const value = await runGraphQL(command, { showSuccessToast: false })
            setPending(false)
            if (value === undefined) {
                setError(t("defaultError"))
                return undefined
            }
            const text = describe?.(value) ?? null
            setNotice(text)
            toast.success(t("successTitle"), { description: text ?? t("defaultSuccess") })
            await Promise.all([mutate(QUERY_HIRING_WORKBENCH_SWR_KEY), mutate(isDetailKey)])
            return value
        },
        [clear, runGraphQL, t],
    )
    return { exec, isPending, error, notice, clear }
}
