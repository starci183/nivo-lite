"use client"

import { useBookingBoard } from "@/hooks/bookingBoard"
import { useFormatter, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { WEEK, hoursLineOf, parseWeek, useBookingSetupSave } from "@/hooks/bookingSetup"
import {
    useMutateRemoveBookingResourceSwr,
    useMutateSaveBookingHoursSwr,
    useMutateSaveBookingResourceSwr,
} from "@/hooks/swr"
import { BookingResourcesBase, buildBookingResourcesState } from "./component"
import type { Draft, ResourceFields, ResourceNotice } from "./component"

const BLANK: ResourceFields = { name: "", kind: "staff", capacity: 1, active: true, staffId: "none" }

/** Draws the connected view from its current state. */
export const BookingResources = () => {
    const { board } = useBookingBoard()
    const t = useTranslations("workbenchBooking")
    const format = useFormatter()
    const persist = useBookingSetupSave()
    const saveResource = useMutateSaveBookingResourceSwr()
    const saveResourceHours = useMutateSaveBookingHoursSwr()
    const removeResource = useMutateRemoveBookingResourceSwr()
    const [draft, setDraft] = useState<Draft | null>(null)
    const [removeId, setRemoveId] = useState<string | null>(null)
    const [notice, setNotice] = useState<ResourceNotice | null>(null)
    const [isPending, startTransition] = useTransition()

    const connected = buildBookingResourcesState({
        board,
        removeId,
        format,
        draft,
        startTransition,
        persist,
        saveResource,
        setDraft,
        setNotice,
        t,
        saveResourceHours,
        isPending,
        notice,
        setRemoveId,
        removeResource,
        parseWeek,
    })

    return <BookingResourcesBase props={bookingResourcesProps(connected)} on={bookingResourcesOn(connected)} />
}

/** Builds the props supplied to BookingResourcesBase. */
const bookingResourcesProps = (
    connected: NonNullable<ReturnType<typeof buildBookingResourcesState>>,
): Parameters<typeof BookingResourcesBase>[0]["props"] => {
    const { t, board, draft, weekdayName, removing, isPending, notice } = connected
    return {
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
        ...(notice === null ? {} : { notice: { tone: notice.ok ? "affirmative" : "negative", text: notice.text } }),
    }
}

/** Builds the on supplied to BookingResourcesBase. */
const bookingResourcesOn = (
    connected: NonNullable<ReturnType<typeof buildBookingResourcesState>>,
): Parameters<typeof BookingResourcesBase>[0]["on"] => {
    const { setDraft, board, setRemoveId, draft, save, saveHours, removeId, startTransition, persist, removeResource } =
        connected
    return {
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
                const answer = await persist(() => removeResource.trigger({ id: removeId }))
                if (answer === undefined) return
                setRemoveId(null)
            })
        },
        cancelRemove: () => setRemoveId(null),
    }
}
