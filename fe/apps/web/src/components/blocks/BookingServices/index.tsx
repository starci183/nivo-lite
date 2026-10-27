"use client"

import { useBookingBoard } from "@/hooks/bookingBoard"
import { useSlotLabels } from "@/hooks/slot"
import { useFormatter, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { useMutateRemoveBookingServiceSwr, useMutateSaveBookingServiceSwr } from "@/hooks/swr"
import { bookingServiceFormOf, useBookingSetupSave } from "@/hooks/bookingSetup"
import {
    BookingServicesBase,
    BLANK_SERVICE_FIELDS,
    bookingServiceDigits,
    serviceFieldsOf,
    type ServiceFields,
} from "./component"

/** The form being edited: a new service has no id. */
interface Draft {
    readonly id: string | null
    readonly fields: ServiceFields
}

/** The connected services list: add, edit and remove the services the shop sells by appointment. */
/** Connects the state and commands used by BookingServices. */
/** Inputs for the connected state mapping. */
interface BuildBookingServicesStateInput {
    readonly board: ReturnType<typeof useBookingBoard>["board"]
    readonly removeId: string | null
    readonly draft: Draft | null
    readonly startTransition: ReturnType<typeof useTransition>[1]
    readonly persist: ReturnType<typeof useBookingSetupSave>
    readonly saveService: ReturnType<typeof useMutateSaveBookingServiceSwr>
    readonly setDraft: import("react").Dispatch<import("react").SetStateAction<Draft | null>>
    readonly removeService: ReturnType<typeof useMutateRemoveBookingServiceSwr>
    readonly setRemoveId: import("react").Dispatch<import("react").SetStateAction<string | null>>
    readonly t: ReturnType<typeof useTranslations<"workbenchBooking">>
    readonly format: ReturnType<typeof useFormatter>
    readonly isPending: ReturnType<typeof useTransition>[0]
}

/** Derives display values and interactions from the supplied state. */
const buildBookingServicesState = ({
    board,
    removeId,
    draft,
    startTransition,
    persist,
    saveService,
    setDraft,
    removeService,
    setRemoveId,
    t,
    format,
    isPending,
}: BuildBookingServicesStateInput) => {
    const removing = board.services.find((service) => service.id === removeId)
    const save = () => {
        if (draft === null) return
        const { fields } = draft
        startTransition(async () => {
            const answer = await persist(() =>
                saveService.trigger({
                    id: draft.id,
                    name: fields.name,
                    description: fields.description,
                    durationMin: fields.durationMin,
                    bufferMin: fields.bufferMin,
                    priceVnd: bookingServiceDigits(fields.price),
                    resourceKind: fields.resourceKind,
                    followupDays: bookingServiceDigits(fields.followup),
                    active: fields.active,
                }),
            )
            if (answer === undefined) return
            setDraft(null)
        })
    }
    const remove = () => {
        if (removeId === null) return
        startTransition(async () => {
            const answer = await persist(() => removeService.trigger({ id: removeId }))
            if (answer === undefined) return
            setRemoveId(null)
        })
    }
    return { t, board, format, draft, removing, isPending, setDraft, setRemoveId, save, remove }
}

/** Draws the connected view from its current state. */
export const BookingServices = () => {
    const { board, slot, reload } = useBookingBoard()
    const slotLabels = useSlotLabels()
    const t = useTranslations("workbenchBooking")
    const format = useFormatter()
    const persist = useBookingSetupSave()
    const saveService = useMutateSaveBookingServiceSwr()
    const removeService = useMutateRemoveBookingServiceSwr()
    const [draft, setDraft] = useState<Draft | null>(null)
    const [removeId, setRemoveId] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const connected = buildBookingServicesState({
        board,
        removeId,
        draft,
        startTransition,
        persist,
        saveService,
        setDraft,
        removeService,
        setRemoveId,
        t,
        format,
        isPending,
    })
    return (
        <BookingServicesBase
            props={{
                ...bookingServicesProps(connected),
                isPending: connected.isPending || slot.isLoading === true,
                slot,
                slotLabels: slotLabels(t("loadFailedTitle")),
            }}
            on={{ ...bookingServicesOn(connected), retry: reload }}
        />
    )
}

/** Builds the props supplied to BookingServicesBase. */
const bookingServicesProps = (
    connected: NonNullable<ReturnType<typeof buildBookingServicesState>>,
): Omit<Parameters<typeof BookingServicesBase>[0]["props"], "slot" | "slotLabels"> => {
    const { t, board, format, draft, removing, isPending } = connected
    return {
        title: t("servicesTitle"),
        hint: t("servicesHint"),
        list: {
            label: t("servicesTitle"),
            emptyText: t("servicesEmpty"),
            editLabel: t("edit"),
            removeLabel: t("remove"),
            rows: board.services.map((service) => ({
                id: service.id,
                title: service.name,
                detail: [
                    t("minutes", { n: service.durationMin }),
                    service.priceVnd === null
                        ? ""
                        : format.number(service.priceVnd, {
                              style: "currency",
                              currency: "VND",
                              maximumFractionDigits: 0,
                          }),
                    service.resourceKind ?? "",
                    service.active ? "" : t("servicePaused"),
                ]
                    .filter((part) => part !== "")
                    .join(" · "),
            })),
        },
        addLabel: t("serviceAdd"),
        ...(draft === null
            ? {}
            : {
                  form: bookingServiceFormOf(draft, t),
              }),
        ...(removing === undefined
            ? {}
            : {
                  removing: {
                      title: t("serviceRemoveTitle", { name: removing.name }),
                      description: t("serviceRemoveBody"),
                      confirmLabel: t("remove"),
                      cancelLabel: t("keep"),
                  },
              }),
        isPending,
    }
}

/** Builds the on supplied to BookingServicesBase. */
const bookingServicesOn = (
    connected: NonNullable<ReturnType<typeof buildBookingServicesState>>,
): Omit<Parameters<typeof BookingServicesBase>[0]["on"], "retry"> => {
    const { setDraft, board, setRemoveId, draft, save, remove } = connected
    return {
        add: () => setDraft({ id: null, fields: BLANK_SERVICE_FIELDS }),
        edit: (id) => {
            const service = board.services.find((candidate) => candidate.id === id)
            if (service === undefined) return
            setDraft({ id, fields: serviceFieldsOf(service) })
        },
        ask: setRemoveId,
        change: (patch) => draft !== null && setDraft({ ...draft, fields: { ...draft.fields, ...patch } }),
        save,
        cancelForm: () => setDraft(null),
        confirmRemove: remove,
        cancelRemove: () => setRemoveId(null),
    }
}
