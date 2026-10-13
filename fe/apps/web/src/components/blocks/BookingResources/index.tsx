"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { useSWRConfig } from "swr"
import { WEEK, hoursLineOf, parseWeek } from "@/hooks/bookingSetup"
import {
    isQueryBookingBoardSwrKey,
    useMutateRemoveBookingResourceSwr,
    useMutateSaveBookingHoursSwr,
    useMutateSaveBookingResourceSwr,
} from "@/hooks/swr/api/graphql"
import { useGraphQLWithToast } from "@/modules/toast"
import type { BookingBoard } from "@/modules/types"
import { BookingResourcesBase } from "./component"
import type { ResourceFields } from "./component"

/** What the setup tab hands the connected people and rooms list. */
interface BookingResourcesProps {
    readonly board: BookingBoard
}

/** The form being edited: a new resource has no id and no hours yet. */
interface Draft {
    readonly id: string | null
    readonly fields: ResourceFields
    readonly lines: ReadonlyArray<string>
}

const BLANK: ResourceFields = { name: "", kind: "staff", capacity: 1, active: true, staffId: "none" }

/** The connected people and rooms list: add, edit and remove them and set their weekly hours. */
export const BookingResources = (props: BookingResourcesProps) => {
    const t = useTranslations("workbenchBooking")
    const format = useFormatter()
    const withToast = useGraphQLWithToast()
    const { mutate } = useSWRConfig()
    const saveResource = useMutateSaveBookingResourceSwr()
    const saveResourceHours = useMutateSaveBookingHoursSwr()
    const removeResource = useMutateRemoveBookingResourceSwr()
    const { board } = props
    const [draft, setDraft] = useState<Draft | null>(null)
    const [removeId, setRemoveId] = useState<string | null>(null)
    const [notice, setNotice] = useState<{ readonly ok: boolean; readonly text: string } | null>(null)
    const [isPending, startTransition] = useTransition()
    const removing = board.resources.find((resource) => resource.id === removeId)
    const weekdayName = (day: number) =>
        format.dateTime(new Date(Date.UTC(2024, 0, day)), { weekday: "short", timeZone: "UTC" })
    const save = () => {
        if (draft === null) return
        const { fields } = draft
        startTransition(async () => {
            const answer = await withToast(
                () =>
                    saveResource.trigger({
                        id: draft.id,
                        name: fields.name,
                        kind: fields.kind,
                        capacity: fields.capacity,
                        active: fields.active,
                        staffId: fields.staffId === "none" ? null : fields.staffId,
                    }),
                { successMessage: t("saved") },
            )
            if (answer === undefined) return
            setDraft(null)
            void mutate(isQueryBookingBoardSwrKey)
        })
    }
    const saveHours = () => {
        if (draft === null || draft.id === null) return
        const week = parseWeek(draft.lines)
        if ("badWeekday" in week)
            return setNotice({ ok: false, text: t("hoursInvalid", { day: weekdayName(week.badWeekday) }) })
        const resourceId = draft.id
        startTransition(async () => {
            const answer = await withToast(() => saveResourceHours.trigger({ resourceId, rows: week.rows }), {
                successMessage: t("saved"),
            })
            if (answer === undefined) return
            void mutate(isQueryBookingBoardSwrKey)
        })
    }
    return (
        <BookingResourcesBase
            props={{
                title: t("resourcesTitle"),
                hint: t("resourcesHint"),
                list: {
                    label: t("resourcesTitle"),
                    emptyText: t("resourcesEmpty"),
                    editLabel: t("edit"),
                    removeLabel: t("remove"),
                    rows: board.resources.map((resource) => ({
                        id: resource.id,
                        title: resource.name,
                        detail: [
                            resource.kind,
                            t("resourceCapacity", { n: resource.capacity }),
                            resource.active ? "" : t("resourcePaused"),
                        ]
                            .filter((part) => part !== "")
                            .join(" · "),
                    })),
                },
                addLabel: t("resourceAdd"),
                ...(draft === null
                    ? {}
                    : {
                          form: {
                              heading: draft.id === null ? t("resourceAdd") : draft.fields.name,
                              fields: draft.fields,
                              nameLabel: t("resourceName"),
                              kindLabel: t("resourceKind"),
                              capacityLabel: t("resourceCapacityLabel"),
                              activeLabel: t("resourceActive"),
                              staffLabel: t("resourceStaff"),
                              staffOptions: [
                                  { id: "none", label: t("resourceNoStaff") },
                                  ...board.staff.map((person) => ({ id: person.id, label: person.name })),
                              ],
                              hoursHeading: t("hoursHeading"),
                              hoursHint: t("hoursHint"),
                              hours: WEEK.map((day) => ({
                                  day,
                                  label: weekdayName(day),
                                  value: draft.lines[day - 1] ?? "",
                              })),
                              hoursPlaceholder: t("hoursPlaceholder"),
                              saveLabel: t("save"),
                              saveHoursLabel: t("hoursSave"),
                              cancelLabel: t("cancel"),
                              canSaveHours: draft.id !== null,
                          },
                      }),
                ...(removing === undefined
                    ? {}
                    : {
                          removing: {
                              title: t("resourceRemoveTitle", { name: removing.name }),
                              description: t("resourceRemoveBody"),
                              confirmLabel: t("remove"),
                              cancelLabel: t("keep"),
                          },
                      }),
                isPending,
                ...(notice === null
                    ? {}
                    : { notice: { tone: notice.ok ? "affirmative" : "negative", text: notice.text } }),
            }}
            on={{
                add: () => setDraft({ id: null, fields: BLANK, lines: [] }),
                edit: (id) => {
                    const resource = board.resources.find((candidate) => candidate.id === id)
                    if (resource === undefined) return
                    setDraft({
                        id,
                        fields: {
                            name: resource.name,
                            kind: resource.kind,
                            capacity: resource.capacity,
                            active: resource.active,
                            staffId: resource.staffId ?? "none",
                        },
                        lines: WEEK.map((day) => hoursLineOf(board.hours, id, day)),
                    })
                },
                ask: setRemoveId,
                change: (patch) => draft !== null && setDraft({ ...draft, fields: { ...draft.fields, ...patch } }),
                changeHours: (day, value) =>
                    draft !== null &&
                    setDraft({
                        ...draft,
                        lines: WEEK.map((weekday) => (weekday === day ? value : (draft.lines[weekday - 1] ?? ""))),
                    }),
                save,
                saveHours,
                cancelForm: () => setDraft(null),
                confirmRemove: () => {
                    if (removeId === null) return
                    startTransition(async () => {
                        const answer = await withToast(() => removeResource.trigger({ id: removeId }), {
                            successMessage: t("saved"),
                        })
                        if (answer === undefined) return
                        setRemoveId(null)
                        void mutate(isQueryBookingBoardSwrKey)
                    })
                },
                cancelRemove: () => setRemoveId(null),
            }}
        />
    )
}
