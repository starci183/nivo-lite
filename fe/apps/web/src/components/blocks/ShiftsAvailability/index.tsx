"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useShiftsFormat, useShiftsWhenFields } from "@/hooks/shifts"
import { useShiftsRuleCommands } from "@/hooks/shiftsCommands"
import type { ShiftsBenchView } from "@/modules/types"
import { ShiftsAvailabilityBase } from "./component"

/** The bench whose approved availability is listed and extended. */
interface ShiftsAvailabilityProps {
    readonly bench: ShiftsBenchView
}

/** What is typed in the availability form. */
interface AvailabilityForm {
    readonly staffId: string
    readonly mode: string
    readonly weekday: string
    readonly date: string
    readonly start: string
    readonly end: string
    readonly available: boolean
}

const LIST_LIMIT = 40

/** The availability of each person, entered by the manager: the form and the approved rows with remove. */
export const ShiftsAvailability = (props: ShiftsAvailabilityProps) => {
    const t = useTranslations("shifts")
    const format = useShiftsFormat()
    const commands = useShiftsRuleCommands()
    const { staff } = props.bench.setup
    const [form, setForm] = useState<AvailabilityForm>({
        staffId: "",
        mode: "weekday",
        weekday: "0",
        date: props.bench.today,
        start: "07:00",
        end: "22:00",
        available: false,
    })
    const [isBusy, setIsBusy] = useState(false)
    const staffId = form.staffId === "" ? (staff[0]?.id ?? "") : form.staffId
    const isWeekly = form.mode === "weekday"
    const when = useShiftsWhenFields(form, props.bench.today)
    const approved = props.bench.allAvailability.filter((row) => row.status === "approved").slice(0, LIST_LIMIT)

    const run = async (job: () => Promise<boolean>): Promise<void> => {
        setIsBusy(true)
        await job()
        setIsBusy(false)
    }
    const add = () =>
        run(() =>
            commands.addAvailability({
                staffId,
                weekday: isWeekly ? Number(form.weekday) : null,
                date: isWeekly ? null : form.date,
                start: form.start,
                end: form.end,
                available: form.available,
            }),
        )
    const whenOf = (weekday: number | null, date: string | null): string =>
        date === null ? format.weekdayName(weekday ?? 0, "long") : format.dayMonth(date)

    return (
        <ShiftsAvailabilityBase
            props={{
                title: t("availMgrTitle"),
                hint: t("availMgrHint"),
                fields: [
                    {
                        id: "staffId",
                        label: t("fStaff"),
                        value: staffId,
                        options: staff.map((person) => ({ id: person.id, label: person.name })),
                    },
                    ...when,
                ],
                switchLabel: t(form.available ? "canWork" : "cannotWork"),
                switchOn: form.available,
                submitLabel: t("availAddBtn"),
                submitVariant: "outline",
                isBusy,
                canSubmit: staffId !== "",
                rows: approved.map((row) => ({
                    id: row.id,
                    text: `${staff.find((person) => person.id === row.staffId)?.name ?? "-"}: ${t(row.available ? "canWork" : "cannotWork")} ${whenOf(row.weekday, row.date)} ${row.start}-${row.end}`,
                    badge: null,
                    actionLabel: t("remove"),
                })),
            }}
            on={{
                field: (id, value) => setForm((current) => ({ ...current, [id]: value })),
                available: (available) => setForm((current) => ({ ...current, available })),
                submit: () => void add(),
                remove: (id) => void run(() => commands.removeAvailability(id)),
            }}
        />
    )
}
