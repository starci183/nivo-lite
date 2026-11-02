"use client"

import { useMutateRequestContentQuickDraftSwr } from "@/hooks/swr"
import type { ContentAiStatusType } from "@/hooks/swr"
import { useTranslations } from "next-intl"
import { useContentAiJob } from "./useContentAiJob"

/** Requests a new quick draft and delivers the completed item after cache revalidation. */
export const useRequestContentQuickDraft = (
    onSucceeded: (status: ContentAiStatusType) => void,
    isActive = true,
    scope?: string,
) => {
    const t = useTranslations("content")
    const { trigger } = useMutateRequestContentQuickDraftSwr()
    return useContentAiJob({
        isActive,
        ...(scope === undefined ? {} : { scope }),
        queue: trigger,
        successMessage: (status) => t("draftReady", { s: status.seconds ?? 0 }),
        onSucceeded,
    })
}
