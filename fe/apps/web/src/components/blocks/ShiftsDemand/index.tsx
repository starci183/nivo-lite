"use client"

import { ShiftsDemandBase, type DemandForm } from "./component"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useShiftsBenchData, useShiftsFormat } from "@/hooks/shifts"
import { useShiftsSetupCommands } from "@/hooks/shiftsCommands"

/** State values and commands consumed by the connected surface. */
type ShiftsDemandControllerInput = {
    readonly t: ReturnType<typeof useTranslations<"shifts">>
    readonly isBusy: boolean
    readonly setIsBusy: React.Dispatch<React.SetStateAction<boolean>>
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
    const { setIsBusy, form, bench, commands } = context

    const { positions, blocks } = bench.setup
    const positionId = form.positionId === "" ? (positions[0]?.id ?? "") : form.positionId
    const positionName = (id: string): string => positions.find((position) => position.id === id)?.name ?? ""

    const run = async (job: () => Promise<boolean>): Promise<boolean> => {
        setIsBusy(true)
        const done = await job()
        setIsBusy(false)
        return done
    }
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

const renderShiftsDemand = (
    context: ReturnType<typeof createShiftsDemandRows>,
): React.ComponentProps<typeof ShiftsDemandBase> => {
    const { t, format, form, setForm, commands, positions, blocks, positionId, positionName, run, add, isBusy } =
        context

    return {
        props: {
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
            dayOptions: WEEK.map((day) => ({ value: String(day), label: format.weekdayName(day, "short") })),
            timeOptions: format.times,
            positionOptions: positions.map((position) => ({ id: position.id, label: position.name })),
            form: { ...form, positionId },
            hasBlocks: blocks.length > 0,
            isBusy,
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
            add: () => void add(),
            remove: (id) => void run(() => commands.removeCoverage(id)),
        },
    }
}

/** The people needed per time block: the blocks by weekday and the form that adds blocks over several days. */
export const ShiftsDemand = () => {
    const t = useTranslations("shifts")
    const [isBusy, setIsBusy] = useState(false)
    const format = useShiftsFormat()
    const [form, setForm] = useState<DemandForm>(INITIAL)
    const bench = useShiftsBenchData(null).data
    const commands = useShiftsSetupCommands()
    const state: ShiftsDemandControllerInput = { t, isBusy, setIsBusy, format, form, setForm, bench, commands }
    if (bench === undefined || bench.role === "staff") return null
    return <ShiftsDemandBase {...renderShiftsDemand(createShiftsDemandRows({ ...state, bench }))} />
}
