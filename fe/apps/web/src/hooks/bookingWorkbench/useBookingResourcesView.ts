"use client"

import { useFeatureReset } from "@/hooks/reuseables"

import type { useBookingBoard } from "@/hooks/bookingBoard"
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
import type { ResourceFields } from "@/modules/types"

const BLANK: ResourceFields = { name: "", kind: "staff", capacity: 1, active: true, staffId: "none" }

/** The view `useBookingResourcesView` returns. */
export interface BookingResourcesView {
    readonly props: {
        readonly isPending: boolean
        readonly notice?: {
            tone: "negative" | "affirmative"
            text: string
        }
        readonly removing?: {
            title: string
            description: string
            confirmLabel: string
            cancelLabel: string
        }
        readonly form?: {
            heading: string
            fields: ResourceFields
            nameLabel: string
            kindLabel: string
            capacityLabel: string
            activeLabel: string
            staffLabel: string
            staffOptions: {
                id: string
                label: string
            }[]
            hoursHeading: string
            hoursHint: string
            hours: {
                day: 3 | 2 | 1 | 4 | 5 | 6 | 7
                label: string
                value: string
            }[]
            hoursPlaceholder: string
            saveLabel: string
            saveHoursLabel: string
            cancelLabel: string
            canSaveHours: boolean
        }
        readonly title: string
        readonly hint: string
        readonly list: {
            readonly label: string
            readonly emptyText: string
            readonly editLabel: string
            readonly removeLabel: string
            readonly rows: {
                id: string
                title: string
                detail: string
            }[]
        }
        readonly addLabel: string
    }
    readonly on: {
        readonly add: () => void
        readonly edit: (id: string) => void
        readonly ask: (id: string) => void
        readonly change: (patch: Partial<ResourceFields>) => false | void
        readonly changeHours: (day: number, value: string) => false | void
        readonly save: () => void
        readonly saveHours: () => void
        readonly cancelForm: () => void
        readonly confirmRemove: () => void
        readonly cancelRemove: () => void
    }
}

/** Draws the connected view from its current state. */
export const useBookingResourcesView = (
    isActive: boolean,
    scope: string,
    boardRead: ReturnType<typeof useBookingBoard>,
): BookingResourcesView => {
    const { board } = boardRead
    const t = useTranslations("workbenchBooking")
    const format = useFormatter()
    const commands = useBookingResourceCommands()
    const { draft, setDraft, removeId, setRemoveId, isPending, startTransition } =
        useBookingCatalogEditor<ResourceDraft>(isActive, scope)
    const [notice, setNotice] = useState<ResourceNotice | null>(null)
    useFeatureReset({
        isActive: isActive,
        isReady: true,
        scope: scope,
        onReset: () => {
            setNotice(null)
        },
    })

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

    return {
        props: { ...bookingResourcesProps(connected), isPending: connected.isPending },
        on: { ...bookingResourcesOn(connected) },
    } as const
}

/** Builds the props supplied to BookingResourcesBase. */
const bookingResourcesProps = (connected: NonNullable<ReturnType<typeof buildBookingResourcesState>>) => {
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
        ...(notice === null
            ? {}
            : { notice: { tone: notice.ok ? ("affirmative" as const) : ("negative" as const), text: notice.text } }),
    } as const
}

/** Builds the on supplied to BookingResourcesBase. */
const bookingResourcesOn = (connected: NonNullable<ReturnType<typeof buildBookingResourcesState>>) => {
    const { setDraft, board, setRemoveId, draft, save, saveHours, removeId, startTransition, commands } = connected
    return {
        add: () => setDraft({ id: null, fields: BLANK, lines: [] }),
        edit: (id: string) => {
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
        ask: (id: string) => setRemoveId(id),
        change: (patch: Partial<ResourceFields>) =>
            draft !== null && setDraft({ ...draft, fields: { ...draft.fields, ...patch } }),
        changeHours: (day: number, value: string) =>
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
            startTransition(async (isCurrent) => {
                const answer = await commands.removeResource({ id: removeId })
                if (answer === undefined || !isCurrent()) return
                setRemoveId(null)
            })
        },
        cancelRemove: () => setRemoveId(null),
    } as const
}
