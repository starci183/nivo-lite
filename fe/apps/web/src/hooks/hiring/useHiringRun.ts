"use client"
import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { mutate } from "@/modules/viewer-cache"
import { QUERY_HIRING_CANDIDATE_DETAIL_SWR_KEY, QUERY_HIRING_WORKBENCH_SWR_KEY } from "@/hooks/swr"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import { matchesSwrKey } from "@/modules/utils"

/** The real active panel/record identity of a Hiring controller, never a read-status bag. */
export interface HiringOwner {
    readonly isActive: boolean
    readonly scope: string
}

/** The command outcome and origin-owned local feedback of one Hiring surface. */
export interface HiringRun {
    readonly exec: <T>(
        command: () => Promise<T>,
        describe?: (value: T) => string | undefined,
        onDone?: (value: T) => void,
    ) => Promise<T | undefined>
    readonly dispatch: <T>(
        command: () => Promise<T>,
        describe?: (value: T) => string | undefined,
        onDone?: (value: T) => void,
    ) => void
    readonly isPending: boolean
    readonly error: string | null
    readonly notice: string | null
    readonly clear: () => void
}

type Operation = () => boolean
interface HiringExecution {
    readonly capture: () => Operation
    readonly pending: Dispatch<SetStateAction<ReadonlyArray<Operation>>>
    readonly error: (message: string | null) => void
    readonly notice: (message: string | null) => void
    readonly clear: () => void
    readonly runGraphQL: ReturnType<typeof useGraphQLWithToast>
    readonly t: ReturnType<typeof useTranslations<"toast">>
}
const isDetailKey = (key: unknown): boolean => Array.isArray(key) && key[0] === QUERY_HIRING_CANDIDATE_DETAIL_SWR_KEY

/** A normal promise retains remote feedback/revalidation while only its origin may update local UI. */
const executeHiring = async <T>(
    input: HiringExecution,
    command: () => Promise<T>,
    describe?: (value: T) => string | undefined,
    onDone?: (value: T) => void,
): Promise<T | undefined> => {
    const isCurrent = input.capture()
    if (!isCurrent()) return undefined
    input.clear()
    input.pending((current) => [...current, isCurrent])
    try {
        const value = await input.runGraphQL(command, { showSuccessToast: false })
        if (value === undefined) {
            if (isCurrent()) input.error(input.t("defaultError"))
            return undefined
        }
        const text = describe?.(value) ?? null
        if (isCurrent()) input.notice(text)
        toast.success(input.t("successTitle"), { description: text ?? input.t("defaultSuccess") })
        await Promise.all([mutate(matchesSwrKey(QUERY_HIRING_WORKBENCH_SWR_KEY)), mutate(isDetailKey)])
        if (isCurrent()) onDone?.(value)
        return value
    } catch (error) {
        await input.runGraphQL(() => Promise.reject(error), { showSuccessToast: false })
        return undefined
    } finally {
        if (isCurrent()) input.pending((current) => current.filter((operation) => operation !== isCurrent))
    }
}

/** Owns active-scope operation identities through real remote completion, without resetting SWR. */
export const useHiringRun = (owner?: HiringOwner): HiringRun => {
    const t = useTranslations("toast")
    const runGraphQL = useGraphQLWithToast()
    const { activeWorkspaceId } = useActiveWorkspace()
    const isActive = owner?.isActive ?? true
    const scope = owner?.scope ?? JSON.stringify([activeWorkspaceId])
    const lifetime = useFeatureLifetime(isActive, scope)
    const [pending, setPending] = useState<ReadonlyArray<Operation>>([])
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const clear = useCallback(() => {
        setError(null)
        setNotice(null)
    }, [])
    useFeatureReset({
        isActive,
        isReady: true,
        scope,
        onReset: () => {
            setPending([])
            setError(null)
            setNotice(null)
        },
    })
    const exec = useCallback<HiringRun["exec"]>(
        (command, describe, onDone) =>
            executeHiring(
                {
                    capture: lifetime.capture,
                    pending: setPending,
                    error: setError,
                    notice: setNotice,
                    clear,
                    runGraphQL,
                    t,
                },
                command,
                describe,
                onDone,
            ),
        [clear, lifetime, runGraphQL, t],
    )
    const dispatch = useCallback<HiringRun["dispatch"]>(
        (command, describe, onDone) => {
            exec(command, describe, onDone).catch((error) =>
                runGraphQL(() => Promise.reject(error), { showSuccessToast: false }),
            )
        },
        [exec, runGraphQL],
    )
    return { exec, dispatch, isPending: pending.length > 0, error, notice, clear }
}
