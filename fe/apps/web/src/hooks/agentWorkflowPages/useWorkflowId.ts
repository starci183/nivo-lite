"use client"

import { useLocale } from "next-intl"
import { useQueryAgentWorkflowsSwr } from "@/hooks/swr"

/** The workflow of a key (or of an id, as the old addresses carried it): its id, or an empty string while the list is unread. */
export const useWorkflowId = (installationId: string, key: string): string => {
    const locale = useLocale()
    const list = useQueryAgentWorkflowsSwr({ installationId, locale })
    return list.data?.find((one) => one.key === key || one.id === key)?.id ?? ""
}
