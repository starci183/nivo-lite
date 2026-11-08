"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    GOAL_TITLE_MAX,
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
    readonly module: string
    readonly installationId: string
}

const presetOf = (value: string | null): AgentWorkPreset | null =>
    WORK_PRESETS.find((preset) => preset === value) ?? null

/** The words of the Work tab that do not come from the data. */
const copyOf = (t: ReturnType<typeof useTranslations<"agentWork">>): AgentWorkCopy => ({
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
    turnsTitle: t("turnsTitle"),
    turnsEmpty: t("turnsEmpty"),
    turnOpenItem: t("openWorkItem"),
    readOnlyHint: t("readOnlyHint"),
    formOpen: t("formOpen"),
    formCancel: t("formCancel"),
    phoneLabel: t("phoneLabel"),
    phoneWork: t("phoneWork"),
    phoneGoals: t("phoneGoals"),
})

/** The connected Work tab: it reads the work of the instance, keeps the two small forms, and sends the commands. */
export const AgentWorkPanes = (props: AgentWorkPanesProps) => {
    const t = useTranslations("agentWork")
    const slotLabels = useSlotLabels()
    const { slot, reload } = useAgentWork(props.module, props.installationId)
    const actions = useAgentWorkActions(props.installationId)
    const [goalTitle, setGoalTitle] = useState("")
    const [preset, setPreset] = useState<AgentWorkPreset>("daily_at")
    const [atTime, setAtTime] = useState("09:00")
    const [openForm, setOpenForm] = useState<"goal" | "clock" | null>(null)
    const [phoneView, setPhoneView] = useState<"work" | "goals">("work")
    const needsTime = presetNeedsTime(preset)
    const isTimeInvalid = needsTime && atTime !== "" && !TIME_OF_DAY.test(atTime)
    const title = goalTitle.trim()
    const addGoal = async (): Promise<void> => {
        if (await actions.addGoal(title)) {
            setGoalTitle("")
            setOpenForm(null)
        }
    }
    return (
        <AgentWorkPanesBase
            props={{
                copy: copyOf(t),
                slot,
                placeholder: WORK_PLACEHOLDER,
                slotLabels: slotLabels(t("emptyWork")),
                grid: agentWorkGridOf(phoneView),
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
                    openForm,
                    phoneView,
                },
                isSaving: actions.isSaving,
            }}
            on={{
                goalTitle: (value) => setGoalTitle(value.slice(0, GOAL_TITLE_MAX)),
                addGoal: () => void addGoal(),
                closeGoal: (goal) => void actions.closeGoal(goal),
                preset: (value) => setPreset(presetOf(value) ?? "daily_at"),
                atTime: setAtTime,
                addClock: () => {
                    void actions.addClock({ preset, atTime })
                    setOpenForm(null)
                },
                openForm: setOpenForm,
                phoneView: setPhoneView,
                switchTrigger: (trigger, enabled) => void actions.switchTrigger(trigger, enabled),
                removeTrigger: (id) => void actions.removeClock(id),
                closeTask: (id) => void actions.closeTask(id),
                retry: reload,
            }}
        />
    )
}
