"use client"

import { useBookingBoard } from "@/hooks/bookingBoard"
import { useSlotLabels } from "@/hooks/slot"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import {
    WEEK,
    buildBookingResourcesState,
    useBookingCatalogEditor,
    hoursLineOf,
    useBookingResourceCommands,
    type ResourceDraft,
    type ResourceNotice,
} from "@/hooks/bookingSetup"
import { BookingResourcesBase } from "./component"
import type { ResourceFields } from "@/modules/types"

const BLANK: ResourceFields = { name: "", kind: "staff", capacity: 1, active: true, staffId: "none" }

/** Draws the connected view from its current state. */
export const BookingResources = () => {
    const { board, slot, reload } = useBookingBoard()
    const slotLabels = useSlotLabels()
    const t = useTranslations("workbenchBooking")
    const format = useFormatter()
    const commands = useBookingResourceCommands()
    const { draft, setDraft, removeId, setRemoveId, isPending, startTransition } =
        useBookingCatalogEditor<ResourceDraft>()
    const [notice, setNotice] = useState<ResourceNotice | null>(null)

    const connected = buildBookingResourcesState({
        board,
        removeId,
        format,
        draft,
        startTransition,
        commands,
        setDraft,
        setNotice,
        t,
        isPending,
        notice,
        setRemoveId,
    })

    return (
        <BookingResourcesBase
            props={{
                ...bookingResourcesProps(connected),
                isPending: connected.isPending || slot.isLoading === true,
                slot,
                slotLabels: slotLabels(t("loadFailedTitle")),
            }}
            on={{ ...bookingResourcesOn(connected), retry: reload }}
        />
    )
}

/** Builds the props supplied to BookingResourcesBase. */
const bookingResourcesProps = (
    connected: NonNullable<ReturnType<typeof buildBookingResourcesState>>,
): Omit<Parameters<typeof BookingResourcesBase>[0]["props"], "slot" | "slotLabels"> => {
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
): Omit<Parameters<typeof BookingResourcesBase>[0]["on"], "retry"> => {
    const { setDraft, board, setRemoveId, draft, save, saveHours, removeId, startTransition, commands } = connected
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
                const answer = await commands.removeResource({ id: removeId })
                if (answer === undefined) return
                setRemoveId(null)
            })
        },
        cancelRemove: () => setRemoveId(null),
    }
}
