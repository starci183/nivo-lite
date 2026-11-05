"use client"

import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import { useMutateDecideSalesDraftSwr, useQuerySalesActionStatusSwr } from "@/hooks/swr"
import type { DecideSalesDraftRequest, SalesActionType } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import type { DraftDecision } from "@/hooks/approval"
import { isTerminal } from "./leads.shared"
import { useRevalidateLeadViews } from "./useRevalidateLeadViews"

/** Queues the approval or rejection of a drafted message, tells the person how the job ended and reads the lead views again. */
export const useDraftDecision = (): DraftDecision<SalesActionType> => {
    const t = useTranslations("approval")
    const runGraphQL = useGraphQLWithToast()
    const { activeWorkspaceId } = useActiveWorkspace()
    const revalidate = useRevalidateLeadViews()
    const draft = useMutateDecideSalesDraftSwr()
    const [pendingId, setPendingId] = useState<string>()
    const report = useCallback(
        (result: SalesActionType) => {
            if (result.status === "failed") toast.danger(t("actionFailed", { code: result.errorCode ?? result.status }))
            else if (result.status === "succeeded") toast.success(t("actionCompleted"))
            else toast.success(t("actionQueued"))
        },
        [t],
    )
    useQuerySalesActionStatusSwr(pendingId === undefined ? undefined : activeWorkspaceId, pendingId, {
        onSuccess: (result: SalesActionType) => {
            if (!isTerminal(result.status)) return
            report(result)
            setPendingId(undefined)
            void revalidate()
        },
        onError: (error: unknown) => toast.danger(error instanceof Error ? error.message : t("loadFailed")),
    })
    const decide = async (input: DecideSalesDraftRequest): Promise<SalesActionType | undefined> => {
        if (pendingId !== undefined) return undefined
        const result = await runGraphQL(() => draft.trigger(input), { showSuccessToast: false })
        if (result === undefined) return undefined
        report(result)
        if (isTerminal(result.status)) await revalidate()
        else setPendingId(result.id)
        return result
    }
    return { decide, isMutating: draft.isMutating || pendingId !== undefined }
}
