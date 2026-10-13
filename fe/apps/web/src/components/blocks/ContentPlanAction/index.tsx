"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { monthKey, pad2, shiftMonth, vietnamClock, useRequestContentMonthPlan, useContentData } from "@/hooks/content"
import { useContentMonthPlanForm } from "@/hooks/rhf"
import { ContentPlanActionBase } from "./component"

const MONTHS_OFFERED = 4

/** The page command of the Content workbench: "Plan the month" picks a month and waits for OpenClaw (one to two minutes). */
export const ContentPlanAction = () => {
    const data = useContentData()
    const t = useTranslations("content")
    const job = useRequestContentMonthPlan()
    const here = vietnamClock(new Date(data.nowIso))
    const [isOpen, setOpen] = useState(false)
    const form = useContentMonthPlanForm(monthKey(here.y, here.m))
    const plan = data.lastPlan
    const run = form.handleSubmit(async ({ month }) => {
        await job.request(month)
    })
    const error = form.formState.errors.month?.message
    return (
        <ContentPlanActionBase
            props={{
                t,
                isOpen,
                months: Array.from({ length: MONTHS_OFFERED }, (_, i) => {
                    const next = shiftMonth(here.y, here.m, i)
                    return { id: monthKey(next.y, next.m), label: `${pad2(next.m)}/${next.y}` }
                }),
                month: form.watch("month"),
                lastPlan:
                    plan === null
                        ? null
                        : t("planLast", {
                              n: plan.ideas,
                              month: plan.month.slice(0, 7).split("-").reverse().join("/"),
                              s: Math.round((plan.ms ?? 0) / 1000),
                          }),
                isPending: form.formState.isSubmitting || job.isPending,
                note: error ? { tone: "error", text: error } : null,
            }}
            on={{
                open: () => setOpen(true),
                close: () => setOpen(false),
                month: (month) => form.setValue("month", month, { shouldValidate: form.formState.isSubmitted }),
                run: () => void run(),
                dismissNote: () => form.clearErrors(),
            }}
        />
    )
}
