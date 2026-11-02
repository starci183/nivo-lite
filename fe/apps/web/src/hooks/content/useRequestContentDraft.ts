"use client"

import { useMutateRequestContentDraftSwr } from "@/hooks/swr"
import type { ContentAiStatusType } from "@/hooks/swr"
import { useTranslations } from "next-intl"
import { useContentAiJob } from "./useContentAiJob"

/** Requests a saved item draft and keeps the editor busy until its queued work finishes. */
export const useRequestContentDraft = (
    onSucceeded?: (status: ContentAiStatusType) => void,
    isActive = true,
    scope?: string,
) => {
    const t = useTranslations("content")
    const { trigger } = useMutateRequestContentDraftSwr()
    const job = useContentAiJob({
        isActive,
        ...(scope === undefined ? {} : { scope }),
        queue: trigger,
        successMessage: (status) => t("draftReady", { s: status.seconds ?? 0 }),
        onSucceeded,
    })
    return {
        ...job,
        request: (id: string, hint?: string) => job.request({ id, hint }),
    }
}
