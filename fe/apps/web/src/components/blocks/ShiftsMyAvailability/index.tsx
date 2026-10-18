"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { requestStatusOf, useShiftsFormat, useShiftsMineData, useShiftsWhenFields } from "@/hooks/shifts"
import { useShiftsMineCommands } from "@/hooks/shiftsCommands"
import { ShiftsMyAvailabilityBase } from "./component"

/** What is typed in the availability form. */
interface AvailabilityForm {
    readonly mode: string
    readonly weekday: string
    readonly date: string
    readonly start: string
    readonly end: string
    readonly note: string
    readonly available: boolean
}

const LIST_LIMIT = 10
const NO_OPTIONS: ReadonlyArray<{ readonly id: string; readonly label: string }> = []

/** When I can work: tell the shop the days or hours I cannot, and see what was approved. */
export const ShiftsMyAvailability = () => {
    const t = useTranslations("shifts")
    const format = useShiftsFormat()
    const mine = useShiftsMineData().data
    const commands = useShiftsMineCommands()
    const [form, setForm] = useState<AvailabilityForm>({
        mode: "weekday",
        weekday: "0",
        date: "",
        start: "07:00",
        end: "22:00",
        note: "",
        available: true,
    })
    const [isBusy, setIsBusy] = useState(false)
    const today = mine?.today ?? ""
    const date = form.date === "" ? today : form.date
    const isWeekly = form.mode === "weekday"
    const when = useShiftsWhenFields({ ...form, date }, today)
    if (mine?.profileId === undefined || mine.profileId === null) return null

    const send = async () => {
        setIsBusy(true)
        const done = await commands.sendAvailability({
            weekday: isWeekly ? Number(form.weekday) : null,
            date: isWeekly ? null : date,
            start: form.start,
            end: form.end,
            available: form.available,
            note: form.note,
        })
        setIsBusy(false)
        if (done) setForm((current) => ({ ...current, note: "" }))
    }
    const whenOf = (weekday: number | null, date: string | null): string =>
        date === null ? format.weekdayName(weekday ?? 0, "long") : format.dayMonth(date)

    return (
        <ShiftsMyAvailabilityBase
            props={{
                title: t("availTitle"),
                hint: t("availHint"),
                fields: [...when, { id: "note", label: t("note"), value: form.note, options: NO_OPTIONS }],
                switchLabel: t(form.available ? "canWork" : "cannotWork"),
                switchOn: form.available,
                submitLabel: t("sendAvail"),
                submitVariant: "primary",
                isBusy,
                canSubmit: true,
                rows: mine.availability.slice(0, LIST_LIMIT).map((row) => ({
                    id: row.id,
                    text: `${t(row.available ? "canWork" : "cannotWork")} ${whenOf(row.weekday, row.date)} ${row.start}-${row.end}`,
                    badge: { tone: requestStatusOf(row.status).tone, label: t(requestStatusOf(row.status).key) },
                    actionLabel: null,
                })),
            }}
            on={{
                field: (id, value) => setForm((current) => ({ ...current, [id]: value })),
                available: (available) => setForm((current) => ({ ...current, available })),
                submit: () => void send(),
            }}
        />
    )
}
