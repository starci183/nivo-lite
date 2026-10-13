"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useShiftsFormat } from "@/hooks/shifts"
import { useShiftsRuleCommands } from "@/hooks/shiftsCommands"
import type { ShiftsBenchView } from "@/modules/types"
import { ShiftsRulesBase } from "./component"
import type { RuleField } from "./component"

/** The bench whose rules and opening hours are edited. */
interface ShiftsRulesProps {
    readonly bench: ShiftsBenchView
}

/** The opening hours as typed: one entry per weekday, `null` for a closed day. */
type Hours = Readonly<Record<string, { readonly open: string; readonly close: string } | null>>

const WEEK = [0, 1, 2, 3, 4, 5, 6] as const
const DEFAULT_OPEN = "07:00"
const DEFAULT_CLOSE = "22:00"

/** The rules of the shop (notice periods, reminders, overtime) and its opening hours by weekday. */
export const ShiftsRules = (props: ShiftsRulesProps) => {
    const t = useTranslations("shifts")
    const format = useShiftsFormat()
    const commands = useShiftsRuleCommands()
    const { settings } = props.bench.setup
    const [rules, setRules] = useState<Record<RuleField, number>>({
        swap: settings.swapNoticeHours,
        leave: settings.leaveNoticeDays,
        remind: settings.remindMinutes,
        noshow: settings.noshowMinutes,
        overtime: settings.overtimeHoursWeek,
    })
    const [hours, setHours] = useState<Hours>(() =>
        Object.fromEntries(WEEK.map((day) => [String(day), settings.openingHours[String(day)] ?? null])),
    )
    const [isBusy, setIsBusy] = useState(false)

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
        setHours((current) => ({ ...current, [day]: next }))

    return (
        <ShiftsRulesBase
            props={{
                title: t("rulesTitle"),
                hint: t("rulesHint"),
                hoursTitle: t("hoursTitle"),
                closedLabel: t("closedDay"),
                saveLabel: t("save"),
                reminderLabel: t(props.bench.reminderOn ? "reminderOn" : "reminderOff"),
                reminderHint: props.bench.reminderOn ? "" : t("reminderOffHint"),
                reminderOn: props.bench.reminderOn,
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
            }}
            on={{
                rule: (field, value) => setRules((current) => ({ ...current, [field]: value })),
                toggle: (day, isOpen) => change(day, isOpen ? { open: DEFAULT_OPEN, close: DEFAULT_CLOSE } : null),
                end: (day, end, value) =>
                    change(day, {
                        open: hours[day]?.open ?? DEFAULT_OPEN,
                        close: hours[day]?.close ?? DEFAULT_CLOSE,
                        [end]: value,
                    }),
                save: () => void save(),
            }}
        />
    )
}
