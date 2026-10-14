"use client"

import { useTranslations } from "next-intl"
import { useMutateRequestContentDraftSwr } from "@/hooks/swr"
import type { ContentAiStatusType } from "@/modules/api"
import { useContentAiJob } from "./useContentAiJob"

/** Requests a saved item draft and keeps the editor busy until its queued work finishes. */
export const useRequestContentDraft = (onSucceeded?: (status: ContentAiStatusType) => void) => {
    const t = useTranslations("content")
    const { trigger, isMutating } = useMutateRequestContentDraftSwr()
    const job = useContentAiJob({
        queue: trigger,
        isMutating,
        successMessage: (status) => t("draftReady", { s: status.seconds ?? 0 }),
        onSucceeded,
    })
    return {
        ...job,
        request: (id: string, hint?: string) => job.request({ id, hint }),
    }
}
