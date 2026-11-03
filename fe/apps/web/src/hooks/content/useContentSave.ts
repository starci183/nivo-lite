"use client"
import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import { useGraphQLWithToast } from "@/modules/toast"
import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { useContentRefresh } from "./useContentRefresh"

/** The real settings surface that owns a configuration command's local pending state. */
export interface ContentSaveOwner {
    readonly isActive: boolean
    readonly scope: string
}
type Operation = () => boolean
interface ContentSaveExecution<TArgs extends unknown[], TResult> {
    readonly trigger: (...args: TArgs) => Promise<TResult>
    readonly args: TArgs
    readonly onResult: ((result: TResult | undefined) => void) | undefined
    readonly capture: () => Operation
    readonly pending: Dispatch<SetStateAction<ReadonlyArray<Operation>>>
    readonly runGraphQL: ReturnType<typeof useGraphQLWithToast>
    readonly refresh: ReturnType<typeof useContentRefresh>["refresh"]
    readonly successMessage: string
}

/** The existing configuration write owns feedback, cache refresh and local completion before its pending ends. */
const executeContentSave = async <TArgs extends unknown[], TResult>(input: ContentSaveExecution<TArgs, TResult>) => {
    const isCurrent = input.capture()
    if (!isCurrent()) return undefined
    input.pending((current) => [...current, isCurrent])
    try {
        const result = await input.runGraphQL(() => input.trigger(...input.args), {
            successMessage: input.successMessage,
        })
        if (result !== undefined) await input.refresh()
        if (isCurrent()) input.onResult?.(result)
        return result
    } catch (error) {
        await input.runGraphQL(() => Promise.reject(error), { showSuccessToast: false })
        return undefined
    } finally {
        if (isCurrent()) input.pending((current) => current.filter((operation) => operation !== isCurrent))
    }
}

/** Runs the same saved-configuration command with origin pending through its actual refresh and reporter settlement. */
export const useContentSave = <TArgs extends unknown[], TResult>(
    trigger: (...args: TArgs) => Promise<TResult>,
    owner?: ContentSaveOwner,
): {
    exec: (args: TArgs, onResult?: (result: TResult | undefined) => void) => Promise<TResult | undefined>
    isPending: boolean
} => {
    const t = useTranslations("content"),
        runGraphQL = useGraphQLWithToast()
    const { refresh } = useContentRefresh()
    const { activeWorkspaceId } = useActiveWorkspace()
    const isActive = owner?.isActive ?? true,
        scope = owner?.scope ?? JSON.stringify([activeWorkspaceId])
    const lifetime = useFeatureLifetime(isActive, scope)
    const [pending, setPending] = useState<ReadonlyArray<Operation>>([])
    useFeatureReset({ isActive, isReady: true, scope, onReset: () => setPending([]) })
    const exec = useCallback(
        (args: TArgs, onResult?: (result: TResult | undefined) => void) =>
            executeContentSave({
                trigger,
                args,
                onResult,
                capture: lifetime.capture,
                pending: setPending,
                runGraphQL,
                refresh,
                successMessage: t("saveDone"),
            }),
        [trigger, lifetime, runGraphQL, refresh, t],
    )
    return { exec, isPending: pending.length > 0 }
}
