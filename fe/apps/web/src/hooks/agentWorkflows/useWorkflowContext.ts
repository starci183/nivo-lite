"use client"

import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useMemo } from "react"
import type { WorkflowContext } from "@/modules/agentWorkflows"
import { stepsLocaleOf } from "@/modules/workflowSteps"

/** The words and the clock the views of the workflows need: one object, made again only when the language changes. */
export const useWorkflowContext = (): WorkflowContext => {
    const t = useTranslations("agentWorkflows")
    const format = useFormatter()
    const locale = stepsLocaleOf(useLocale())
    return useMemo(
        () => ({
            t: (key, values) => t(key, values),
            locale,
            has: (key) => t.has(key),
            dateOf: (iso) => format.dateTime(new Date(iso), { day: "2-digit", month: "2-digit", year: "numeric" }),
        }),
        [t, format, locale],
    )
}
