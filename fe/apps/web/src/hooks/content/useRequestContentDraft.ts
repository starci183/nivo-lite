"use client"

import { useMutateRequestContentDraftSwr } from "@/hooks/swr"
import type { ContentAiStatusType } from "@/hooks/swr"
import { useTranslations } from "next-intl"
import { useContentAiJob } from "./useContentAiJob"

/** The view `useRequestContentDraft` returns. */
export interface RequestContentDraftView {
    request: (
        id: string,
        hint?: string,
    ) => Promise<
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

/** Requests a saved item draft and keeps the editor busy until its queued work finishes. */
export const useRequestContentDraft = (
    onSucceeded?: (status: ContentAiStatusType) => void,
    isActive = true,
    scope?: string,
): RequestContentDraftView => {
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
