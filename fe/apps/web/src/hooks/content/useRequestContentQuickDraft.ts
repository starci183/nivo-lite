"use client"

import { useMutateRequestContentQuickDraftSwr } from "@/hooks/swr"
import type { ContentAiStatusType } from "@/hooks/swr"
import { useTranslations } from "next-intl"
import { useContentAiJob } from "./useContentAiJob"

/** The view `useRequestContentQuickDraft` returns. */
export interface RequestContentQuickDraftView {
    request: (input: { channels: string[]; topic: string }) => Promise<
        | {
              id: string
              itemId: string | null
              status: string
          }
        | undefined
    >
    status:
        | {
              id: string
              status: string
              progress: number
              itemId: string | null
              planId: string | null
              resultId: string | null
              ideas: number | null
              seconds: number | null
              skippedPast: number | null
              errorCode: string | null
              warnings: Array<{
                  channel: string
                  warning: {
                      kind: string
                      phrase: string | null
                      figure: string | null
                      length: number | null
                      max: number | null
                  }
              }>
          }
        | undefined
    isPending: boolean
}

/** Requests a new quick draft and delivers the completed item after cache revalidation. */
export const useRequestContentQuickDraft = (
    onSucceeded: (status: ContentAiStatusType) => void,
    isActive = true,
    scope?: string,
): RequestContentQuickDraftView => {
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
