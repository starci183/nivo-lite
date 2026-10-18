"use client"

import {
    type Hours,
    type ShiftsRulesControllerInput,
    type CreateShiftsRulesRowsInput,
    ShiftsRulesBase,
    type RuleField,
} from "./component"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useShiftsBenchData, useShiftsFormat } from "@/hooks/shifts"
import { useShiftsRuleCommands } from "@/hooks/shiftsCommands"

const createShiftsRulesRows = (context: CreateShiftsRulesRowsInput) => {
    const { commands, bench, ruleEdits, hourEdits, setHourEdits, setIsBusy } = context

    const { settings } = bench.setup
    const rules: Record<RuleField, number> = {
        swap: ruleEdits.swap ?? settings.swapNoticeHours,
        leave: ruleEdits.leave ?? settings.leaveNoticeDays,
        remind: ruleEdits.remind ?? settings.remindMinutes,
        noshow: ruleEdits.noshow ?? settings.noshowMinutes,
        overtime: ruleEdits.overtime ?? settings.overtimeHoursWeek,
    }
    const hours: Hours = Object.fromEntries(
        WEEK.map((day) => {
            const key = String(day)
            return [key, key in hourEdits ? (hourEdits[key] ?? null) : (settings.openingHours[key] ?? null)]
        }),
    )

    const save = async () => {
        setIsBusy(true)
        await commands.saveSettings({
            swapNoticeHours: rules.swap,
            leaveNoticeDays: rules.leave,
            remindMinutes: rules.remind,
            noshowMinutes: rules.noshow,
            overtimeHoursWeek: rules.overtime,
            openingHours: hours,
        })
        setIsBusy(false)
    }
    const change = (day: string, next: { open: string; close: string } | null) =>
        setHourEdits((current) => ({ ...current, [day]: next }))
    return { ...context, rules, hours, save, change }
}

const renderShiftsRules = (
    context: ReturnType<typeof createShiftsRulesRows>,
): React.ComponentProps<typeof ShiftsRulesBase> => {
    const { t, format, bench, setRuleEdits, rules, hours, save, change, isBusy } = context

    return {
        props: {
            title: t("rulesTitle"),
            hint: t("rulesHint"),
            hoursTitle: t("hoursTitle"),
            closedLabel: t("closedDay"),
            saveLabel: t("save"),
            reminderLabel: t(bench.reminderOn ? "reminderOn" : "reminderOff"),
            reminderHint: bench.reminderOn ? "" : t("reminderOffHint"),
            reminderOn: bench.reminderOn,
            fields: [
                { id: "swap", label: t("rSwap"), value: rules.swap, min: 0, max: 168 },
                { id: "leave", label: t("rLeave"), value: rules.leave, min: 0, max: 60 },
                { id: "remind", label: t("rRemind"), value: rules.remind, min: 5, max: 1440 },
                { id: "noshow", label: t("rNoShow"), value: rules.noshow, min: 1, max: 120 },
                { id: "overtime", label: t("rOvertime"), value: rules.overtime, min: 1, max: 120 },
            ],
            days: WEEK.map((day) => {
                const hoursOfDay = hours[String(day)] ?? null
                return {
                    id: String(day),
                    label: format.weekdayName(day, "long"),
                    isOpen: hoursOfDay !== null,
                    ends: [
                        { id: "open", label: t("fromTime"), value: hoursOfDay?.open ?? DEFAULT_OPEN },
                        { id: "close", label: t("toTime"), value: hoursOfDay?.close ?? DEFAULT_CLOSE },
                    ],
                }
            }),
            timeOptions: format.times,
            isBusy,
        },
        on: {
            rule: (field, value) => setRuleEdits((current) => ({ ...current, [field]: value })),
            toggle: (day, isOpen) => change(day, isOpen ? { open: DEFAULT_OPEN, close: DEFAULT_CLOSE } : null),
            end: (day, end, value) =>
                change(day, {
                    open: hours[day]?.open ?? DEFAULT_OPEN,
                    close: hours[day]?.close ?? DEFAULT_CLOSE,
                    [end]: value,
                }),
            save: () => void save(),
        },
    }
}

/** The opening hours as typed: one entry per weekday, `null` for a closed day. */

const WEEK = [0, 1, 2, 3, 4, 5, 6] as const
const DEFAULT_OPEN = "07:00"
const DEFAULT_CLOSE = "22:00"

/** The rules of the shop (notice periods, reminders, overtime) and its opening hours by weekday. */
export const ShiftsRules = () => {
    const t = useTranslations("shifts")
    const format = useShiftsFormat()
    const commands = useShiftsRuleCommands()
    const bench = useShiftsBenchData(null).data
    const [ruleEdits, setRuleEdits] = useState<Partial<Record<RuleField, number>>>({})
    const [hourEdits, setHourEdits] = useState<Hours>({})
    const [isBusy, setIsBusy] = useState(false)
    const state: ShiftsRulesControllerInput = {
        t,
        format,
        commands,
        bench,
        ruleEdits,
        setRuleEdits,
        hourEdits,
        setHourEdits,
        isBusy,
        setIsBusy,
    }
    if (bench === undefined || bench.role === "staff") return null
    return <ShiftsRulesBase {...renderShiftsRules(createShiftsRulesRows({ ...state, bench }))} />
}
