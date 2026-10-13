"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useShiftsBenchData, useShiftsFormat } from "@/hooks/shifts"
import { useShiftsSetupCommands } from "@/hooks/shiftsCommands"
import { ShiftsDemandBase } from "./component"
import type { DemandForm } from "./component"

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

/** The people needed per time block: the blocks by weekday and the form that adds blocks over several days. */
export const ShiftsDemand = () => {
    const t = useTranslations("shifts")
    const [isBusy, setIsBusy] = useState(false)
    const format = useShiftsFormat()
    const [form, setForm] = useState<DemandForm>(INITIAL)
    const bench = useShiftsBenchData(null).data
    const commands = useShiftsSetupCommands()
    if (bench === undefined || bench.role === "staff") return null

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

    return (
        <ShiftsDemandBase
            props={{
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
            }}
            on={{
                days: (days) => setForm((current) => ({ ...current, days })),
                start: (start) => setForm((current) => ({ ...current, start })),
                end: (end) => setForm((current) => ({ ...current, end })),
                position: (id) => setForm((current) => ({ ...current, positionId: id })),
                min: (min) => setForm((current) => ({ ...current, min, ideal: Math.max(current.ideal, min) })),
                ideal: (ideal) => setForm((current) => ({ ...current, ideal })),
                peak: (peak) => setForm((current) => ({ ...current, peak })),
                add: () => void add(),
                remove: (id) => void run(() => commands.removeCoverage(id)),
            }}
        />
    )
}
