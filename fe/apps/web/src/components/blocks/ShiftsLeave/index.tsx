"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { requestStatusOf, useShiftsFormat } from "@/hooks/shifts"
import { useShiftsMineCommands } from "@/hooks/shiftsCommands"
import type { ShiftsMineView } from "@/modules/types"
import { ShiftsLeaveBase } from "./component"

/** The person's view. */
interface ShiftsLeaveProps {
    readonly mine: ShiftsMineView
}

/** What is typed in the leave form. */
interface LeaveForm {
    readonly from: string
    readonly to: string
    readonly reason: string
}

const DATE_CHOICES = 90
const LIST_LIMIT = 6
const NO_OPTIONS: ReadonlyArray<{ readonly id: string; readonly label: string }> = []

/** Ask for leave: the day range and the reason, and my latest requests with their state. */
export const ShiftsLeave = (props: ShiftsLeaveProps) => {
    const t = useTranslations("shifts")
    const format = useShiftsFormat()
    const commands = useShiftsMineCommands()
    const { today } = props.mine
    const [form, setForm] = useState<LeaveForm>({ from: today, to: today, reason: "" })
    const [isBusy, setIsBusy] = useState(false)
    const dates = format.dates(today, DATE_CHOICES)

    const send = async () => {
        setIsBusy(true)
        const done = await commands.requestLeave(form.from, form.to, form.reason)
        setIsBusy(false)
        if (done) setForm((current) => ({ ...current, reason: "" }))
    }
    const spanOf = (from: string, to: string): string =>
        to === from ? format.dayMonth(from) : `${format.dayMonth(from)} - ${format.dayMonth(to)}`

    return (
        <ShiftsLeaveBase
            props={{
                title: t("leaveTitle"),
                hint: t("leaveHint"),
                fields: [
                    { id: "from", label: t("fromDate"), value: form.from, options: dates },
                    {
                        id: "to",
                        label: t("toDate"),
                        value: form.to,
                        options: dates.filter((option) => option.id >= form.from),
                    },
                    { id: "reason", label: t("reason"), value: form.reason, options: NO_OPTIONS },
                ],
                switchLabel: null,
                switchOn: false,
                submitLabel: t("sendLeave"),
                submitVariant: "primary",
                isBusy,
                canSubmit: true,
                rows: props.mine.leaves.slice(0, LIST_LIMIT).map((leave) => ({
                    id: leave.id,
                    text: [spanOf(leave.from, leave.to), leave.reason].filter((part) => part !== "").join(" · "),
                    badge: { tone: requestStatusOf(leave.status).tone, label: t(requestStatusOf(leave.status).key) },
                    actionLabel: null,
                })),
            }}
            on={{
                field: (id, value) =>
                    setForm((current) => ({
                        ...current,
                        [id]: value,
                        to: id === "from" && current.to < value ? value : current.to,
                    })),
                submit: () => void send(),
            }}
        />
    )
}
