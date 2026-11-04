import { useFeatureReset } from "@/hooks/reuseables"
import { useShiftsOperation } from "./useShiftsOperation"
import type { ShiftsSetupViews, ShiftsSetupActions } from "@/modules/types"
import type { ShiftsPanelInput } from "./shiftsWorkbench.shared"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useShiftsBenchData, useShiftsFormat } from "@/hooks/shifts"
import { useShiftsRuleCommands } from "@/hooks/shiftsCommands"

type FullView = { readonly props: ShiftsSetupViews["rulesData"]; readonly on: ShiftsSetupActions["rules"] }
type RuleField = ShiftsSetupViews["rulesRuleField"]

/** The opening hours as typed: one entry per weekday, `null` for a closed day. */
type Hours = Readonly<Record<string, { readonly open: string; readonly close: string } | null>>

/** State values and commands consumed by the connected surface. */
type ShiftsRulesControllerInput = {
    readonly t: ReturnType<typeof useTranslations<"shifts">>
    readonly format: ReturnType<typeof useShiftsFormat>
    readonly commands: ReturnType<typeof useShiftsRuleCommands>
    readonly bench: NonNullable<ReturnType<typeof useShiftsBenchData>>["data"]
    readonly ruleEdits: Partial<Record<RuleField, number>>
    readonly setRuleEdits: React.Dispatch<React.SetStateAction<Partial<Record<RuleField, number>>>>
    readonly hourEdits: Hours
    readonly setHourEdits: React.Dispatch<React.SetStateAction<Hours>>
    readonly isBusy: boolean
    readonly operation: ReturnType<typeof useShiftsOperation>
}

/** Narrowed schedule data available after the access guard. */
type CreateShiftsRulesRowsInput = ShiftsRulesControllerInput & {
    bench: NonNullable<ShiftsRulesControllerInput["bench"]>
}

const createShiftsRulesRows = (context: CreateShiftsRulesRowsInput) => {
    const { commands, bench, ruleEdits, hourEdits, setHourEdits, operation } = context

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
        await operation.run("write", () =>
            commands.saveSettings({
                swapNoticeHours: rules.swap,
                leaveNoticeDays: rules.leave,
                remindMinutes: rules.remind,
                noshowMinutes: rules.noshow,
                overtimeHoursWeek: rules.overtime,
                openingHours: hours,
            }),
        )
    }
    const change = (day: string, next: { open: string; close: string } | null) =>
        setHourEdits((current) => ({ ...current, [day]: next }))
    return { ...context, rules, hours, save, change }
}

const renderShiftsRules = (context: ReturnType<typeof createShiftsRulesRows>): FullView => {
    const { t, format, bench, setRuleEdits, rules, hours, save, change, operation } = context

    return {
        props: {
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
            save: () => operation.observe(save()),
        },
    }
}

const WEEK = [0, 1, 2, 3, 4, 5, 6] as const
const DEFAULT_OPEN = "07:00"
const DEFAULT_CLOSE = "22:00"

type UseShiftsRulesViewResult =
    | { copy: ShiftsSetupViews["rulesCopy"]; data: undefined; on: undefined }
    | { copy: ShiftsSetupViews["rulesCopy"]; data: FullView["props"]; on: FullView["on"] }

/** The rules of the shop (notice periods, reminders, overtime) and its opening hours by weekday. */
export const useShiftsRulesView = (input: ShiftsPanelInput): UseShiftsRulesViewResult => {
    const t = useTranslations("shifts")
    const format = useShiftsFormat()
    const commands = useShiftsRuleCommands()
    const bench = input.bench.data
    const [ruleEdits, setRuleEdits] = useState<Partial<Record<RuleField, number>>>({})
    const [hourEdits, setHourEdits] = useState<Hours>({})
    const operation = useShiftsOperation(input)
    const isBusy = operation.tag !== null
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
        operation,
    }
    useFeatureReset({
        isActive: input.isActive,
        isReady: true,
        scope: input.scope,
        onReset: () => {
            setRuleEdits({})
            setHourEdits({})
        },
    })

    const copy: ShiftsSetupViews["rulesCopy"] = {
        fieldStructure: [
            { id: "swap", label: t("rSwap"), min: 0, max: 168 },
            { id: "leave", label: t("rLeave"), min: 0, max: 60 },
            { id: "remind", label: t("rRemind"), min: 5, max: 1440 },
            { id: "noshow", label: t("rNoShow"), min: 1, max: 120 },
            { id: "overtime", label: t("rOvertime"), min: 1, max: 120 },
        ],
        dayStructure: WEEK.map((day) => ({ id: String(day), label: format.weekdayName(day, "long") })),
        openingLabel: t("fromTime"),
        closingLabel: t("toTime"),
        title: t("rulesTitle"),
        hint: t("rulesHint"),
        hoursTitle: t("hoursTitle"),
        closedLabel: t("closedDay"),
        saveLabel: t("save"),
        timeOptions: format.times,
        isBusy,
    }

    if (bench === undefined || bench.role === "staff") return { copy, data: undefined, on: undefined }
    const view: FullView = renderShiftsRules(createShiftsRulesRows({ ...state, bench }))
    return { copy, data: view.props, on: view.on }
}
