"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { monthKey, pad2, shiftMonth, useContentCommand, vietnamClock, type LastPlan } from "@/hooks/content"
import { writePlanMonth } from "@/modules/db/content-ai/write-plan"
import { ContentPlanActionBase } from "./component"

/** Props of {@link ContentPlanAction}. */
export interface ContentPlanActionProps {
    /** The current time, read on the server. */
    readonly nowIso: string
    /** The last finished plan, when there is one. */
    readonly lastPlan: LastPlan | null
}

const MONTHS_OFFERED = 4

/** The page command of the Content workbench: "Plan the month" picks a month and waits for OpenClaw (one to two minutes). */
export const ContentPlanAction = (props: ContentPlanActionProps) => {
    const t = useTranslations("content")
    const command = useContentCommand()
    const here = vietnamClock(new Date(props.nowIso))
    const [isOpen, setOpen] = useState(false)
    const [month, setMonth] = useState(monthKey(here.y, here.m))
    const plan = props.lastPlan
    const run = () =>
        command.run(
            "plan",
            () => writePlanMonth(month),
            (done) => {
                if (done.kind !== "ok") return
                const past = done.value.skippedPast > 0 ? ` ${t("planDonePast", { n: done.value.skippedPast })}` : ""
                command.say("ok", `${t("planDone", { n: done.value.ideas, s: done.value.seconds })}${past}`)
            },
        )
    return (
        <ContentPlanActionBase
            props={{
                t,
                isOpen,
                months: Array.from({ length: MONTHS_OFFERED }, (_, i) => {
                    const next = shiftMonth(here.y, here.m, i)
                    return { id: monthKey(next.y, next.m), label: `${pad2(next.m)}/${next.y}` }
                }),
                month,
                lastPlan:
                    plan === null
                        ? null
                        : t("planLast", {
                              n: plan.ideas,
                              month: plan.month.slice(0, 7).split("-").reverse().join("/"),
                              s: Math.round((plan.ms ?? 0) / 1000),
                          }),
                isPending: command.isPending,
                note: command.note,
            }}
            on={{
                open: () => setOpen(true),
                close: () => setOpen(false),
                month: setMonth,
                run,
                dismissNote: command.dismiss,
            }}
        />
    )
}
