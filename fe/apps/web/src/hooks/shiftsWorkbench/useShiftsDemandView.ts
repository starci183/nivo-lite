import { useFeatureReset } from "@/hooks/reuseables"
import { useShiftsOperation } from "./useShiftsOperation"
import type { ShiftsSetupViews, ShiftsSetupActions } from "@/modules/types"
import type { ShiftsPanelInput } from "./shiftsWorkbench.shared"
type FullView = { readonly props: ShiftsSetupViews["demandData"]; readonly on: ShiftsSetupActions["demand"] }
type DemandForm = ShiftsSetupViews["demandDemandForm"]

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useShiftsBenchData, useShiftsFormat } from "@/hooks/shifts"
import { useShiftsSetupCommands } from "@/hooks/shiftsCommands"

/** State values and commands consumed by the connected surface. */
type ShiftsDemandControllerInput = {
    readonly t: ReturnType<typeof useTranslations<"shifts">>
    readonly isBusy: boolean
    readonly operation: ReturnType<typeof useShiftsOperation>
    readonly format: ReturnType<typeof useShiftsFormat>
    readonly form: DemandForm
    readonly setForm: React.Dispatch<React.SetStateAction<DemandForm>>
    readonly bench: NonNullable<ReturnType<typeof useShiftsBenchData>>["data"]
    readonly commands: ReturnType<typeof useShiftsSetupCommands>
}

/** Narrowed schedule data available after the access guard. */
type CreateShiftsDemandRowsInput = ShiftsDemandControllerInput & {
    bench: NonNullable<ShiftsDemandControllerInput["bench"]>
}

const INITIAL: DemandForm = {
    days: ["0", "1", "2", "3", "4"],
    start: "07:00",
    end: "12:00",
    positionId: "",
    min: 1,
    ideal: 1,
    peak: false,
}

const WEEK = [0, 1, 2, 3, 4, 5, 6] as const

const createShiftsDemandRows = (context: CreateShiftsDemandRowsInput) => {
    const { operation, form, bench, commands } = context

    const { positions, blocks } = bench.setup
    const positionId = form.positionId === "" ? (positions[0]?.id ?? "") : form.positionId
    const positionName = (id: string): string => positions.find((position) => position.id === id)?.name ?? ""

    const run = (job: () => Promise<boolean>) => operation.run("write", job)
    const add = () =>
        run(() =>
            commands.saveCoverage({
                weekdays: form.days.map(Number),
                start: form.start,
                end: form.end,
                positionId,
                min: form.min,
                ideal: form.ideal,
                peak: form.peak,
            }),
        )
    return { ...context, positions, blocks, positionId, positionName, run, add }
}

const renderShiftsDemand = (context: ReturnType<typeof createShiftsDemandRows>): FullView => {
    const { t, format, form, setForm, commands, positions, blocks, positionId, positionName, run, add, operation } =
        context

    return {
        props: {
            groups: WEEK.map((day) => ({
                id: String(day),
                label: format.weekdayName(day, "long"),
                blocks: blocks
                    .filter((block) => block.weekday === day)
                    .map((block) => ({
                        id: block.id,
                        label: [
                            `${block.start}-${block.end}`,
                            positionName(block.positionId),
                            block.ideal > block.min ? `${block.min}-${block.ideal}` : String(block.min),
                            block.peak ? t("peakTag") : "",
                        ]
                            .filter((part) => part !== "")
                            .join(" "),
                    })),
            })),
            positionOptions: positions.map((position) => ({ id: position.id, label: position.name })),
            form: { ...form, positionId },
            hasBlocks: blocks.length > 0,
            canAdd: positionId !== "" && form.days.length > 0,
        },
        on: {
            days: (days) => setForm((current) => ({ ...current, days })),
            start: (start) => setForm((current) => ({ ...current, start })),
            end: (end) => setForm((current) => ({ ...current, end })),
            position: (id) => setForm((current) => ({ ...current, positionId: id })),
            min: (min) => setForm((current) => ({ ...current, min, ideal: Math.max(current.ideal, min) })),
            ideal: (ideal) => setForm((current) => ({ ...current, ideal })),
            peak: (peak) => setForm((current) => ({ ...current, peak })),
            add: () => operation.observe(add()),
            remove: (id) => operation.observe(run(() => commands.removeCoverage(id))),
        },
    }
}

/** The people needed per time block: the blocks by weekday and the form that adds blocks over several days. */
export const useShiftsDemandView = (input: ShiftsPanelInput) => {
    const t = useTranslations("shifts")
    const operation = useShiftsOperation(input)
    const isBusy = operation.tag !== null
    const format = useShiftsFormat()
    const [form, setForm] = useState<DemandForm>(INITIAL)
    const bench = input.bench.data
    const commands = useShiftsSetupCommands()
    const state: ShiftsDemandControllerInput = { t, isBusy, operation, format, form, setForm, bench, commands }
    useFeatureReset({
        isActive: input.isActive,
        isReady: true,
        scope: input.scope,
        onReset: () => {
            setForm(INITIAL)
        },
    })

    const copy: ShiftsSetupViews["demandCopy"] = {
        title: t("covTitle"),
        hint: t("covHint"),
        emptyLabel: t("covNone"),
        addTitle: t("covAdd"),
        addLabel: t("covAddBtn"),
        removeLabel: t("remove"),
        labels: {
            days: t("covDays"),
            from: t("fromTime"),
            to: t("toTime"),
            position: t("fPosition"),
            min: t("covMin"),
            ideal: t("covIdeal"),
            peak: t("covPeak"),
        },
        dayOptions: WEEK.map((day) => ({ value: String(day), label: format.weekdayName(day, "short") })),
        timeOptions: format.times,
        isBusy,
    }

    if (bench === undefined || bench.role === "staff") return { copy, data: undefined, on: undefined }
    const view: FullView = renderShiftsDemand(createShiftsDemandRows({ ...state, bench }))
    return { copy, data: view.props, on: view.on }
}
