import { useTranslations } from "next-intl"
import { useShiftsFormat } from "@/hooks/shifts"
import { isoAddDays } from "@/hooks/shiftsTime"
import { useShiftsWeekStore } from "@/hooks/zustand/shiftsWeek"
import type { ShiftsWeekViews, ShiftsWeekActions } from "@/modules/types"
import { useShiftsWeekBarActions } from "./useShiftsWeekBarActions"
import type { ShiftsPanelInput } from "./shiftsWorkbench.shared"
const WEEK_DAYS = 7
/** Resolves the unchanged week navigation, status and captured bar actions. */
export const useShiftsWeekBarView = (input: ShiftsPanelInput) => {
    const t = useTranslations("shifts"),
        format = useShiftsFormat()
    const setMonday = useShiftsWeekStore((state) => state.setMonday)
    const actions = useShiftsWeekBarActions(input)
    const busy = actions.busy
    const progress = () => {
        if (busy === "propose") return t("solving")
        return busy === "explain" ? t("explaining") : ""
    }
    const copy: ShiftsWeekViews["weekBarCopy"] = {
        prevLabel: t("prevWeek"),
        nextLabel: t("nextWeek"),
        todayLabel: t("thisWeek"),
        proposeLabel: t("propose"),
        publishLabel: t("publish"),
        progress: progress(),
        isProposing: busy === "propose" || busy === "explain",
        isPublishing: busy === "publish",
        isDeciding: busy === "decide",
        isIdle: busy === null,
    }
    const bench = input.bench.data
    if (bench === undefined || bench.role === "staff") return { copy, data: undefined, on: undefined }
    const { monday, current, publishItem } = bench.week
    const isDraft = current?.status === "draft",
        isWaiting = publishItem?.status === "waiting_decision"
    const status = (): ShiftsWeekViews["weekBarWeekBarStatusView"] => {
        if (current === null) return { tone: "neutral", label: t("noSchedule") }
        if (isDraft) return { tone: "warning", label: t("draftN", { n: current.version }) }
        return { tone: "success", label: t("publishedN", { n: current.version }) }
    }
    const data: ShiftsWeekViews["weekBarData"] = {
        weekLabel: t("weekOf", { range: format.weekRange(monday) }),
        status: status(),
        isDraft,
        canPublish: isDraft && !isWaiting,
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
        waiting: isWaiting
            ? {
                  title: t("waitingTitle"),
                  description: publishItem.summary,
                  approveLabel: t("approvePublish"),
                  declineLabel: t("declinePublish"),
              }
            : null,
    }
    const on: ShiftsWeekActions["weekBar"] = {
        previous: () => setMonday(isoAddDays(monday, -WEEK_DAYS)),
        next: () => setMonday(isoAddDays(monday, WEEK_DAYS)),
        today: () => setMonday(bench.today),
        propose: actions.propose,
        publish: actions.publish,
        approve: actions.approve,
        decline: actions.decline,
    }
    return { copy, data, on }
}
