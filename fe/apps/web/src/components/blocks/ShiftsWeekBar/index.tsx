"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useShiftsBenchData, useShiftsFormat } from "@/hooks/shifts"
import { useShiftsRequestCommands, useShiftsWeekCommands } from "@/hooks/shiftsCommands"
import { isoAddDays } from "@/hooks/shiftsTime"
import { useShiftsWeekStore } from "@/hooks/zustand/shiftsWeek"
import { ShiftsWeekBarBase } from "./component"
import type { WeekBarStatusView } from "./component"

/** What the bar is waiting for, so the right button shows its pending state. */
type Busy = "propose" | "explain" | "publish" | "decide" | null

const WEEK_DAYS = 7

/** The week bar: navigation, the status of the schedule, propose and publish, and the owner's decision on a waiting publish. */
export const ShiftsWeekBar = () => {
    const t = useTranslations("shifts")
    const format = useShiftsFormat()
    const selected = useShiftsWeekStore((state) => state.monday)
    const setSelected = useShiftsWeekStore((state) => state.setMonday)
    const bench = useShiftsBenchData(selected).data
    const week = useShiftsWeekCommands()
    const requests = useShiftsRequestCommands()
    const [busy, setBusy] = useState<Busy>(null)
    if (bench === undefined || bench.role === "staff") return null

    const { monday, current, publishItem } = bench.week
    const isDraft = current?.status === "draft"
    const isWaiting = publishItem?.status === "waiting_decision"

    const statusOf = (): WeekBarStatusView => {
        if (current === null) return { tone: "neutral", label: t("noSchedule") }
        if (isDraft) return { tone: "warning", label: t("draftN", { n: current.version }) }
        return { tone: "success", label: t("publishedN", { n: current.version }) }
    }
    const progressOf = (): string => {
        if (busy === "propose") return t("solving")
        return busy === "explain" ? t("explaining") : ""
    }
    const run = async (kind: Exclude<Busy, null>, job: () => Promise<unknown>): Promise<void> => {
        setBusy(kind)
        await job()
        setBusy(null)
    }
    const propose = () =>
        run("propose", async () => {
            const scheduleId = await week.propose(monday)
            if (scheduleId === undefined) return
            setBusy("explain")
            await week.explain(scheduleId)
        })
    const publish = () => run("publish", () => (current === null ? Promise.resolve() : week.publish(current.id)))
    const decide = (decision: "approved" | "rejected") =>
        run("decide", () => (publishItem === null ? Promise.resolve() : requests.decideItem(publishItem.id, decision)))

    return (
        <ShiftsWeekBarBase
            props={{
                weekLabel: t("weekOf", { range: format.weekRange(monday) }),
                status: statusOf(),
                prevLabel: t("prevWeek"),
                nextLabel: t("nextWeek"),
                todayLabel: t("thisWeek"),
                proposeLabel: t("propose"),
                publishLabel: t("publish"),
                progress: progressOf(),
                isDraft,
                canPublish: isDraft && !isWaiting,
                isProposing: busy === "propose" || busy === "explain",
                isPublishing: busy === "publish",
                isDeciding: busy === "decide",
                isIdle: busy === null,
                empty:
                    current === null
                        ? {
                              title: t("noScheduleTitle"),
                              body: t(
                                  bench.setup.blocks.length > 0 && bench.setup.staff.length > 0
                                      ? "noScheduleBody"
                                      : "needSetup",
                              ),
                          }
                        : null,
                waiting:
                    isWaiting && publishItem !== null
                        ? {
                              title: t("waitingTitle"),
                              description: publishItem.summary,
                              approveLabel: t("approvePublish"),
                              declineLabel: t("declinePublish"),
                          }
                        : null,
            }}
            on={{
                previous: () => setSelected(isoAddDays(monday, -WEEK_DAYS)),
                next: () => setSelected(isoAddDays(monday, WEEK_DAYS)),
                today: () => setSelected(bench.today),
                propose: () => void propose(),
                publish: () => void publish(),
                approve: () => void decide("approved"),
                decline: () => void decide("rejected"),
            }}
        />
    )
}
