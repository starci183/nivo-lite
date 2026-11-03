"use client"
import type { ContentViews, ContentActions, ContentPlanFields, ContentPlanActions } from "@/modules/types"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { monthKey, pad2, shiftMonth, vietnamClock, useRequestContentMonthPlan } from "@/hooks/content"
import { useContentMonthPlanForm } from "@/hooks/rhf"
import { useFeatureReset } from "@/hooks/reuseables"
import { useGraphQLWithToast } from "@/modules/toast"
import { contentDialogOf, type ContentViewInput } from "./contentWorkbench.shared"

const MONTHS_OFFERED = 4
/** The view `useContentPlanActionView` returns. */
export interface ContentPlanActionView {
    props: ContentPlanFields | undefined
    on: ContentPlanActions
}

/** Owns the actual ContentPlanAction data derivations and conditional controller lifetime. */
export const useContentPlanActionView = (input: ContentViewInput): ContentPlanActionView => {
    const data = input.data
    const t = useTranslations("content")
    const runGraphQL = useGraphQLWithToast()
    const job = useRequestContentMonthPlan(input.isActive && input.isReady, input.scope)
    const here = vietnamClock(new Date(data?.nowIso ?? input.startedAt))
    const [isOpen, setOpen] = useState(false)
    const form = useContentMonthPlanForm(monthKey(here.y, here.m))
    const plan = data?.lastPlan
    const run = form.handleSubmit(({ month }) => job.request(month))
    const error = form.formState.errors.month?.message
    const isPending = form.formState.isSubmitting || job.isPending

    useFeatureReset({
        isActive: input.isActive,
        isReady: input.isReady,
        scope: input.scope,
        onReset: () => {
            form.reset({ month: monthKey(here.y, here.m) })
            setOpen(false)
        },
    })

    const props: ContentViews["planFields"] | undefined =
        data === undefined
            ? undefined
            : {
                  copy: input.copy,
                  isOpen,
                  months: Array.from({ length: MONTHS_OFFERED }, (_, i) => {
                      const next = shiftMonth(here.y, here.m, i)
                      return { id: monthKey(next.y, next.m), label: `${pad2(next.m)}/${next.y}` }
                  }),
                  month: form.watch("month"),
                  lastPlan:
                      plan === null || plan === undefined
                          ? null
                          : t("planLast", {
                                n: plan.ideas,
                                month: plan.month.slice(0, 7).split("-").reverse().join("/"),
                                s: Math.round((plan.ms ?? 0) / 1000),
                            }),
                  isPending,
                  note: error ? { tone: "error", text: error } : null,
              }
    const on: ContentActions["planActions"] = {
        ...contentDialogOf(input, setOpen, isPending),
        month: (month) => form.setValue("month", month, { shouldValidate: form.formState.isSubmitted }),
        run: () => {
            run().catch((error: unknown) => runGraphQL(() => Promise.reject(error), { showSuccessToast: false }))
        },
        dismissNote: () => form.clearErrors(),
    }
    return { props, on }
}
