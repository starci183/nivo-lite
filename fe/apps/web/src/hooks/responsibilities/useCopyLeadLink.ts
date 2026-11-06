"use client"

import { useCallback, useEffect, useState } from "react"
import { leadHref, workspaceHref } from "@/modules/routes"
import { useGraphQLWithToast } from "@/modules/toast"
import { useWorkspaceId } from "@/hooks/workspaces"

const COPIED_MS = 2000

type UseCopyLeadLinkResult = {
    copiedId: string | null
    copy: (responsibilityId: string, leadId: string) => Promise<void>
}

/** Copies the address of a lead to the clipboard, toasts a failure and remembers which responsibility was copied for a moment. */
export const useCopyLeadLink = (): UseCopyLeadLinkResult => {
    const workspaceId = useWorkspaceId()
    const run = useGraphQLWithToast()
    const [copiedId, setCopiedId] = useState<string | null>(null)
    useEffect(() => {
        if (copiedId === null) return undefined
        const timer = window.setTimeout(() => setCopiedId(null), COPIED_MS)
        return () => window.clearTimeout(timer)
    }, [copiedId])
    const copy = useCallback(
        async (responsibilityId: string, leadId: string): Promise<void> => {
            const copied = await run(
                () =>
                    navigator.clipboard.writeText(
                        `${window.location.origin}${workspaceHref(workspaceId, leadHref(leadId))}`,
                    ),
                {
                    showSuccessToast: false,
                    showErrorToast: true,
                },
            )
            if (copied !== undefined) setCopiedId(responsibilityId)
        },
        [run, workspaceId],
    )
    return { copiedId, copy }
}
