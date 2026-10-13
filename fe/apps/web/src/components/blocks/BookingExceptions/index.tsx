"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { writeBookingException, writeBookingExceptionRemoval } from "@/modules/db/booking/write-booking-catalog"
import { navigation } from "@/modules/i18n"
import type { BookingBoard } from "@/modules/types"
import { BookingExceptionsBase } from "./component"
import type { ExceptionFields } from "./component"

const { useRouter } = navigation

/** What the setup tab hands the connected days-off list. */
interface BookingExceptionsProps {
    readonly workspaceId: string
    readonly board: BookingBoard
}

/** The connected days-off list: add a closing or special hours and remove the ones that no longer apply. */
export const BookingExceptions = (props: BookingExceptionsProps) => {
    const t = useTranslations("workbenchBooking")
    const format = useFormatter()
    const router = useRouter()
    const { board } = props
    const [fields, setFields] = useState<ExceptionFields>({
        resourceId: "all",
        date: board.today,
        closed: true,
        start: "09:00",
        end: "12:00",
        note: "",
    })
    const [saved, setSaved] = useState<boolean | null>(null)
    const [isPending, startTransition] = useTransition()
    const nameOf = (id: string | null) =>
        id === null ? t("exceptionWhole") : (board.resources.find((resource) => resource.id === id)?.name ?? "")
    const finish = (ok: boolean) => {
        setSaved(ok)
        if (ok) router.refresh()
    }
    return (
        <BookingExceptionsBase
            props={{
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
                isPending,
                ...(saved === null
                    ? {}
                    : { notice: { tone: saved ? "affirmative" : "negative", text: t(saved ? "saved" : "failed") } }),
            }}
            on={{
                change: (patch) => setFields({ ...fields, ...patch }),
                add: () =>
                    startTransition(async () => {
                        const answer = await writeBookingException({
                            workspaceId: props.workspaceId,
                            resourceId: fields.resourceId === "all" ? null : fields.resourceId,
                            date: fields.date,
                            closed: fields.closed,
                            start: fields.start,
                            end: fields.end,
                            note: fields.note,
                        })
                        finish(answer.kind === "ok")
                    }),
                remove: (id) =>
                    startTransition(async () => {
                        const answer = await writeBookingExceptionRemoval(props.workspaceId, id)
                        finish(answer.kind === "ok")
                    }),
            }}
        />
    )
}
