"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { requestStatusOf, useShiftsFormat, useShiftsMineData } from "@/hooks/shifts"
import { useShiftsMineCommands } from "@/hooks/shiftsCommands"
import { ShiftsLeaveBase } from "./component"

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
export const ShiftsLeave = () => {
    const t = useTranslations("shifts")
    const format = useShiftsFormat()
    const commands = useShiftsMineCommands()
    const mine = useShiftsMineData().data
    const [form, setForm] = useState<LeaveForm>({ from: "", to: "", reason: "" })
    const [isBusy, setIsBusy] = useState(false)
    if (mine?.profileId === undefined || mine.profileId === null) return null

    const from = form.from === "" ? mine.today : form.from
    const to = form.to === "" || form.to < from ? from : form.to
    const dates = format.dates(mine.today, DATE_CHOICES)

    const send = async () => {
        setIsBusy(true)
        const done = await commands.requestLeave(from, to, form.reason)
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
                    { id: "from", label: t("fromDate"), value: from, options: dates },
                    {
                        id: "to",
                        label: t("toDate"),
                        value: to,
                        options: dates.filter((option) => option.id >= from),
                    },
                    { id: "reason", label: t("reason"), value: form.reason, options: NO_OPTIONS },
                ],
                switchLabel: null,
                switchOn: false,
                submitLabel: t("sendLeave"),
                submitVariant: "primary",
                isBusy,
                canSubmit: true,
                rows: mine.leaves.slice(0, LIST_LIMIT).map((leave) => ({
                    id: leave.id,
                    text: [spanOf(leave.from, leave.to), leave.reason].filter((part) => part !== "").join(" · "),
                    badge: { tone: requestStatusOf(leave.status).tone, label: t(requestStatusOf(leave.status).key) },
                    actionLabel: null,
                })),
            }}
            on={{
                field: (id, value) => setForm((current) => ({ ...current, [id]: value })),
                submit: () => void send(),
            }}
        />
    )
}
