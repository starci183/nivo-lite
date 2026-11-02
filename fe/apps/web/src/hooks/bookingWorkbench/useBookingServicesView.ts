"use client"

import { BLANK_SERVICE_FIELDS, bookingServiceDigits, serviceFieldsOf } from "@/modules/booking-desk"
import type { ServiceFields } from "@/modules/booking-desk"

import type { useBookingBoard } from "@/hooks/bookingBoard"
import { useFormatter, useTranslations } from "next-intl"
import type { useBookingTransition } from "@/hooks/bookingDesk"
import { bookingServiceFormOf, useBookingCatalogEditor, useBookingServiceCommands } from "@/hooks/bookingSetup"

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
    readonly startTransition: ReturnType<typeof useBookingTransition>["run"]
    readonly commands: ReturnType<typeof useBookingServiceCommands>
    readonly setDraft: import("react").Dispatch<import("react").SetStateAction<Draft | null>>
    readonly setRemoveId: import("react").Dispatch<import("react").SetStateAction<string | null>>
    readonly t: ReturnType<typeof useTranslations<"workbenchBooking">>
    readonly format: ReturnType<typeof useFormatter>
    readonly isPending: boolean
}

/** Derives display values and interactions from the supplied state. */
const buildBookingServicesState = ({
    board,
    removeId,
    draft,
    startTransition,
    commands,
    setDraft,
    setRemoveId,
    t,
    format,
    isPending,
}: BuildBookingServicesStateInput) => {
    const removing = board.services.find((service) => service.id === removeId)
    const save = () => {
        if (draft === null) return
        const { fields } = draft
        startTransition(async (isCurrent) => {
            const answer = await commands.saveService({
                id: draft.id,
                name: fields.name,
                description: fields.description,
                durationMin: fields.durationMin,
                bufferMin: fields.bufferMin,
                priceVnd: bookingServiceDigits(fields.price),
                resourceKind: fields.resourceKind,
                followupDays: bookingServiceDigits(fields.followup),
                active: fields.active,
            })
            if (answer === undefined || !isCurrent()) return
            setDraft(null)
        })
    }
    const remove = () => {
        if (removeId === null) return
        startTransition(async (isCurrent) => {
            const answer = await commands.removeService({ id: removeId })
            if (answer === undefined || !isCurrent()) return
            setRemoveId(null)
        })
    }
    return { t, board, format, draft, removing, isPending, setDraft, setRemoveId, save, remove } as const
}

/** Draws the connected view from its current state. */
export const useBookingServicesView = (
    isActive: boolean,
    scope: string,
    boardRead: ReturnType<typeof useBookingBoard>,
) => {
    const { board } = boardRead
    const t = useTranslations("workbenchBooking")
    const format = useFormatter()
    const commands = useBookingServiceCommands()
    const { draft, setDraft, removeId, setRemoveId, isPending, startTransition } = useBookingCatalogEditor<Draft>(
        isActive,
        scope,
    )

    const connected = buildBookingServicesState({
        board,
        removeId,
        draft,
        startTransition,
        commands,
        setDraft,
        setRemoveId,
        t,
        format,
        isPending,
    })
    return {
        props: { ...bookingServicesProps(connected), isPending: connected.isPending },
        on: { ...bookingServicesOn(connected) },
    } as const
}

/** Builds the props supplied to BookingServicesBase. */
const bookingServicesProps = (connected: NonNullable<ReturnType<typeof buildBookingServicesState>>) => {
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
    } as const
}

/** Builds the on supplied to BookingServicesBase. */
const bookingServicesOn = (connected: NonNullable<ReturnType<typeof buildBookingServicesState>>) => {
    const { setDraft, board, setRemoveId, draft, save, remove } = connected
    return {
        add: () => setDraft({ id: null, fields: BLANK_SERVICE_FIELDS }),
        edit: (id: string) => {
            const service = board.services.find((candidate) => candidate.id === id)
            if (service === undefined) return
            setDraft({ id, fields: serviceFieldsOf(service) })
        },
        ask: (id: string) => setRemoveId(id),
        change: (patch: Partial<ServiceFields>) =>
            draft !== null && setDraft({ ...draft, fields: { ...draft.fields, ...patch } }),
        save,
        cancelForm: () => setDraft(null),
        confirmRemove: remove,
        cancelRemove: () => setRemoveId(null),
    } as const
}
