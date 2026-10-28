"use client"

import { ShiftsWeekBarBase, type WeekBarStatusView } from "./component"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useShiftsBenchData, useShiftsFormat } from "@/hooks/shifts"
import { useShiftsRequestCommands, useShiftsWeekCommands } from "@/hooks/shiftsCommands"
import { isoAddDays } from "@/hooks/shiftsTime"
import { useShiftsWeekStore } from "@/hooks/zustand/shiftsWeek"

/** State values and commands consumed by the connected surface. */
type Busy = "propose" | "explain" | "publish" | "decide" | null

/** State values and commands consumed by the connected surface. */
type ShiftsWeekBarControllerInput = {
    readonly t: ReturnType<typeof useTranslations<"shifts">>
    readonly format: ReturnType<typeof useShiftsFormat>
    readonly selected: ReturnType<typeof useShiftsWeekStore.getState>["monday"]
    readonly setSelected: ReturnType<typeof useShiftsWeekStore.getState>["setMonday"]
    readonly bench: NonNullable<ReturnType<typeof useShiftsBenchData>>["data"]
    readonly week: ReturnType<typeof useShiftsWeekCommands>
    readonly requests: ReturnType<typeof useShiftsRequestCommands>
    readonly busy: Busy
    readonly setBusy: React.Dispatch<React.SetStateAction<Busy>>
}

/** Narrowed schedule data available after the access guard. */
type CreateShiftsWeekBarRowsInput = ShiftsWeekBarControllerInput & {
    bench: NonNullable<ShiftsWeekBarControllerInput["bench"]>
}

const createShiftsWeekBarRows = (context: CreateShiftsWeekBarRowsInput) => {
    const { t, bench, week, requests, busy, setBusy } = context

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
    return {
        ...context,
        monday,
        current,
        publishItem,
        isDraft,
        isWaiting,
        statusOf,
        progressOf,
        propose,
        publish,
        decide,
    }
}

const renderShiftsWeekBar = (
    context: ReturnType<typeof createShiftsWeekBarRows>,
): React.ComponentProps<typeof ShiftsWeekBarBase> => {
    const {
        t,
        format,
        setSelected,
        bench,
        busy,
        monday,
        current,
        publishItem,
        isDraft,
        isWaiting,
        statusOf,
        progressOf,
        propose,
        publish,
        decide,
    } = context

    return {
        props: {
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
        },
        on: {
            previous: () => setSelected(isoAddDays(monday, -WEEK_DAYS)),
            next: () => setSelected(isoAddDays(monday, WEEK_DAYS)),
            today: () => setSelected(bench.today),
            propose: () => void propose(),
            publish: () => void publish(),
            approve: () => void decide("approved"),
            decline: () => void decide("rejected"),
        },
    }
}

/** What the bar is waiting for, so the right button shows its pending state. */

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
    const state: ShiftsWeekBarControllerInput = {
        t,
        format,
        selected,
        setSelected,
        bench,
        week,
        requests,
        busy,
        setBusy,
    }
    if (bench === undefined || bench.role === "staff") return null
    return <ShiftsWeekBarBase {...renderShiftsWeekBar(createShiftsWeekBarRows({ ...state, bench }))} />
}
