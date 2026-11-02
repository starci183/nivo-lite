"use client"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import { mutate } from "@/modules/viewer-cache"
import { QUERY_INVENTORY_WORKBENCH_SWR_KEY } from "@/hooks/swr"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import { matchesSwrKey } from "@/modules/utils"
/** One inventory command's original scope and local completion ownership. */
interface InventoryOperation {
    readonly identity: ReturnType<typeof useFeatureLifetime>["identity"]
    readonly isCurrent: () => boolean
}
/** What one command run leaves on the screen. */
export interface InventoryRun {
    /** Computes original success copy for every remote outcome; local UI work uses the operation's current guard. */
    readonly exec: <T>(
        command: () => Promise<T>,
        onOk?: (value: T, isCurrent: () => boolean) => string | undefined,
    ) => void
    readonly isPending: boolean
    /** The generic failure line; the domain refusal is already toasted. */
    readonly error: string | null
    readonly notice: string | null
}
/** Owns inventory feedback, actual pending operations and cache refresh across the active panel lifetime. */
export const useInventoryRun = (isActive = true, scope = ""): InventoryRun => {
    const t = useTranslations("toast"),
        runGraphQL = useGraphQLWithToast()
    const lifetime = useFeatureLifetime(isActive, scope)
    const [, start] = useTransition()
    const [operations, setOperations] = useState<ReadonlyArray<InventoryOperation>>([])
    const [error, setError] = useState<string | null>(null),
        [notice, setNotice] = useState<string | null>(null)
    useFeatureReset({
        isActive,
        isReady: true,
        scope,
        onReset: () => {
            setError(null)
            setNotice(null)
        },
    })
    const exec: InventoryRun["exec"] = (command, onOk) => {
        const operation: InventoryOperation = { identity: lifetime.identity, isCurrent: lifetime.capture() }
        setOperations((current) => [...current, operation])
        setError(null)
        setNotice(null)
        start(async () => {
            try {
                const value = await runGraphQL(command, { showSuccessToast: false })
                if (value === undefined) {
                    if (operation.isCurrent()) setError(t("defaultError"))
                    return
                }
                const text = onOk?.(value, operation.isCurrent) ?? null
                if (operation.isCurrent()) setNotice(text)
                toast.success(t("successTitle"), { description: text ?? t("defaultSuccess") })
                await mutate(matchesSwrKey(QUERY_INVENTORY_WORKBENCH_SWR_KEY))
            } finally {
                setOperations((current) => current.filter((entry) => entry !== operation))
            }
        })
    }
    return {
        exec,
        isPending: isActive && operations.some((operation) => operation.identity === lifetime.identity),
        error,
        notice,
    }
}
