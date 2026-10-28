"use client"

import { useBookingBoard } from "@/hooks/bookingBoard"
import { useSlotLabels } from "@/hooks/slot"
import { useFormatter, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { useBookingSettingsCommands } from "@/hooks/bookingSetup"
import { BookingExceptionsBase } from "./component"
import type { ExceptionFields } from "./component"

/** The connected days-off list: add a closing or special hours and remove the ones that no longer apply. */
export const BookingExceptions = () => {
    const { board, slot, reload } = useBookingBoard()
    const slotLabels = useSlotLabels()
    const t = useTranslations("workbenchBooking")
    const format = useFormatter()
    const commands = useBookingSettingsCommands()
    const [fields, setFields] = useState<ExceptionFields>({
        resourceId: "all",
        date: board.today,
        closed: true,
        start: "09:00",
        end: "12:00",
        note: "",
    })
    const [isPending, startTransition] = useTransition()
    const nameOf = (id: string | null) =>
        id === null ? t("exceptionWhole") : (board.resources.find((resource) => resource.id === id)?.name ?? "")
    return (
        <BookingExceptionsBase
            props={{
                slot,
                slotLabels: slotLabels(t("loadFailedTitle")),
                title: t("exceptionsTitle"),
                hint: t("exceptionsHint"),
                rows: board.exceptions.map((row) => ({
                    id: row.id,
                    title: format.dateTime(new Date(`${row.date}T12:00:00Z`), { dateStyle: "medium", timeZone: "UTC" }),
                    detail: [
                        nameOf(row.resourceId),
                        row.closed ? t("exceptionClosed") : `${row.start ?? ""}-${row.end ?? ""}`,
                        row.note,
                    ]
                        .filter((part) => part !== "")
                        .join(" · "),
                })),
                removeLabel: t("remove"),
                fields,
                appliesLabel: t("exceptionApplies"),
                applies: [
                    { id: "all", label: t("exceptionWhole") },
                    ...board.resources.map((resource) => ({ id: resource.id, label: resource.name })),
                ],
                dateLabel: t("fDate"),
                noteLabel: t("fNote"),
                notePlaceholder: t("exceptionNotePlaceholder"),
                closedLabel: t("exceptionClosedAllDay"),
                startLabel: t("exceptionOpens"),
                endLabel: t("exceptionCloses"),
                addLabel: t("add"),
                isPending: isPending || slot.isLoading === true,
            }}
            on={{
                retry: reload,
                change: (patch) => setFields({ ...fields, ...patch }),
                add: () =>
                    startTransition(async () => {
                        const answer = await commands.saveException({
                            resourceId: fields.resourceId === "all" ? null : fields.resourceId,
                            date: fields.date,
                            closed: fields.closed,
                            start: fields.start,
                            end: fields.end,
                            note: fields.note,
                        })
                        if (answer === undefined) return
                    }),
                remove: (id) =>
                    startTransition(async () => {
                        const answer = await commands.removeException({ id })
                        if (answer === undefined) return
                    }),
            }}
        />
    )
}
