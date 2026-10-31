"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    GOAL_TITLE_MAX,
    TIME_OF_DAY,
    WORK_PLACEHOLDER,
    WORK_PRESETS,
    presetNeedsTime,
    useAgentWork,
    useAgentWorkActions,
} from "@/hooks/agentWork"
import { useSlotLabels } from "@/hooks/slot"
import type { AgentWorkPreset } from "@/modules/types"
import { AgentWorkPanesBase } from "./component"

/** The instance whose work the tab shows. */
type AgentWorkPanesProps = {
    readonly module: string
    readonly installationId: string
}

const presetOf = (value: string | null): AgentWorkPreset | null => WORK_PRESETS.find((preset) => preset === value) ?? null

/** The connected Work tab: it reads the work of the instance, keeps the two small forms, and sends the commands. */
export const AgentWorkPanes = (props: AgentWorkPanesProps) => {
    const t = useTranslations("agentWork")
    const slotLabels = useSlotLabels()
    const { slot, reload } = useAgentWork(props.module, props.installationId)
    const actions = useAgentWorkActions(props.installationId)
    const [goalTitle, setGoalTitle] = useState("")
    const [preset, setPreset] = useState<AgentWorkPreset>("daily_at")
    const [atTime, setAtTime] = useState("09:00")
    const needsTime = presetNeedsTime(preset)
    const isTimeInvalid = needsTime && atTime !== "" && !TIME_OF_DAY.test(atTime)
    const title = goalTitle.trim()
    const addGoal = async (): Promise<void> => {
        if (await actions.addGoal(title)) setGoalTitle("")
    }
    return (
        <AgentWorkPanesBase
            props={{
                copy: {
                    paneLabel: t("paneLabel"),
                    goalsTitle: t("goalsTitle"),
                    goalsEmpty: t("goalsEmpty"),
                    goalDone: t("goalMarkDone"),
                    goalNewLabel: t("goalNewLabel"),
                    goalNewPlaceholder: t("goalNewPlaceholder"),
                    goalAdd: t("goalAdd"),
                    tasksTitle: t("tasksTitle"),
                    tasksEmpty: t("tasksEmpty"),
                    taskClose: t("taskClose"),
                    taskOpenItem: t("openWorkItem"),
                    scheduleTitle: t("scheduleTitle"),
                    scheduleEmpty: t("scheduleEmpty"),
                    scheduleSwitch: t("scheduleSwitch"),
                    scheduleRemove: t("scheduleRemove"),
                    scheduleMore: t("rowMore"),
                    presetLabel: t("presetLabel"),
                    timeLabel: t("timeLabel"),
                    timePlaceholder: t("timePlaceholder"),
                    timeInvalid: t("timeInvalid"),
                    scheduleAdd: t("scheduleAdd"),
                    turnsTitle: t("turnsTitle"),
                    turnsEmpty: t("turnsEmpty"),
                    turnOpenItem: t("openWorkItem"),
                    readOnlyHint: t("readOnlyHint"),
                },
                slot,
                placeholder: WORK_PLACEHOLDER,
                slotLabels: slotLabels(t("emptyWork")),
                draft: {
                    goalTitle,
                    canAddGoal: title !== "" && title.length <= GOAL_TITLE_MAX,
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
                },
                isSaving: actions.isSaving,
            }}
            on={{
                goalTitle: (value) => setGoalTitle(value.slice(0, GOAL_TITLE_MAX)),
                addGoal: () => void addGoal(),
                closeGoal: (goal) => void actions.closeGoal(goal),
                preset: (value) => setPreset(presetOf(value) ?? "daily_at"),
                atTime: setAtTime,
                addClock: () => void actions.addClock({ preset, atTime }),
                switchTrigger: (trigger, enabled) => void actions.switchTrigger(trigger, enabled),
                removeTrigger: (id) => void actions.removeClock(id),
                closeTask: (id) => void actions.closeTask(id),
                retry: reload,
            }}
        />
    )
}
