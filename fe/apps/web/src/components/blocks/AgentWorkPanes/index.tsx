"use client"

import { useAgentRoute } from "@/hooks/installations"
import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    TIME_OF_DAY,
    WORK_PLACEHOLDER,
    WORK_PRESETS,
    agentWorkGridOf,
    presetNeedsTime,
    useAgentWork,
    useAgentWorkActions,
} from "@/hooks/agentWork"
import { useSlotLabels } from "@/hooks/slot"
import type { AgentWorkPreset } from "@/modules/types"
import { AgentWorkPanesBase, type AgentWorkCopy } from "./component"

/** The instance whose work the tab shows. */
type AgentWorkPanesProps = {
    readonly module?: string | undefined
    readonly installationId?: string | undefined
}

const presetOf = (value: string | null): AgentWorkPreset | null =>
    WORK_PRESETS.find((preset) => preset === value) ?? null

/** The words of the Work tab that do not come from the data. */
const copyOf = (t: ReturnType<typeof useTranslations<"agentWork">>): AgentWorkCopy => ({
    paneLabel: t("paneLabel"),
    tasksTitle: t("tasksTitle"),
    tasksEmpty: t("tasksEmpty"),
    taskClose: t("taskClose"),
    taskOpenItem: t("openWorkItem"),
    taskMenu: t("taskMenu"),
    scheduleTitle: t("scheduleTitle"),
    scheduleEmpty: t("scheduleEmpty"),
    scheduleSwitch: t("scheduleSwitch"),
    scheduleRemove: t("scheduleRemove"),
    presetLabel: t("presetLabel"),
    timeLabel: t("timeLabel"),
    timePlaceholder: t("timePlaceholder"),
    timeInvalid: t("timeInvalid"),
    scheduleAdd: t("scheduleAdd"),
    readOnlyHint: t("readOnlyHint"),
    formOpen: t("formOpen"),
    formCancel: t("formCancel"),
})

/** The connected Work tab: it reads the work of the instance, keeps the two small forms, and sends the commands. */
export const AgentWorkPanes = (props: AgentWorkPanesProps) => {
    const route = useAgentRoute(props)
    const t = useTranslations("agentWork")
    const slotLabels = useSlotLabels()
    const { slot, reload } = useAgentWork(route.module, route.installationId)
    const actions = useAgentWorkActions(route.installationId)
    const [preset, setPreset] = useState<AgentWorkPreset>("daily_at")
    const [atTime, setAtTime] = useState("09:00")
    const [openForm, setOpenForm] = useState<"clock" | null>(null)
    const needsTime = presetNeedsTime(preset)
    const isTimeInvalid = needsTime && atTime !== "" && !TIME_OF_DAY.test(atTime)
    return (
        <AgentWorkPanesBase
            props={{
                copy: copyOf(t),
                slot,
                placeholder: WORK_PLACEHOLDER,
                slotLabels: slotLabels(t("emptyWork")),
                grid: agentWorkGridOf(),
                draft: {
                    preset,
                    presetOptions: [
                        { id: "every_15m", label: t("optEvery15m") },
                        { id: "hourly", label: t("optHourly") },
                        { id: "daily_at", label: t("optDailyAt") },
                        { id: "weekdays_at", label: t("optWeekdaysAt") },
                    ],
                    needsTime,
                    atTime,
                    isTimeInvalid,
                    canAddClock: !needsTime || TIME_OF_DAY.test(atTime),
                    openForm,
                },
                isSaving: actions.isSaving,
            }}
            on={{
                preset: (value) => setPreset(presetOf(value) ?? "daily_at"),
                atTime: setAtTime,
                addClock: () => {
                    void actions.addClock({ preset, atTime })
                    setOpenForm(null)
                },
                openForm: setOpenForm,
                switchTrigger: (trigger, enabled) => void actions.switchTrigger(trigger, enabled),
                removeTrigger: (id) => void actions.removeClock(id),
                closeTask: (id) => void actions.closeTask(id),
                retry: reload,
            }}
        />
    )
}
