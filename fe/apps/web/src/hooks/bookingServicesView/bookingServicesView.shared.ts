import { BLANK_SERVICE_FIELDS, serviceFieldsOf, type ServiceFields } from "@/modules/booking-desk"
import type { useBookingBoard } from "@/hooks/bookingBoard"
import { bookingServiceFormOf } from "@/hooks/bookingSetup"
import type { useFormatter, useTranslations } from "next-intl"
import type { Dispatch, SetStateAction } from "react"

/** The form being edited: a new service has no id. */
export interface ServiceDraft {
    readonly id: string | null
    readonly fields: ServiceFields
}

/** The state the connected services view builds its props and commands from. */
export interface ServicesConnected {
    readonly t: ReturnType<typeof useTranslations<"workbenchBooking">>
    readonly board: ReturnType<typeof useBookingBoard>["board"]
    readonly format: ReturnType<typeof useFormatter>
    readonly draft: ServiceDraft | null
    readonly removing: ReturnType<typeof useBookingBoard>["board"]["services"][number] | undefined
    readonly isPending: boolean
    readonly setDraft: Dispatch<SetStateAction<ServiceDraft | null>>
    readonly setRemoveId: Dispatch<SetStateAction<string | null>>
    readonly save: () => void
    readonly remove: () => void
}

/** The props of the services panel. */
export interface BookingServicesProps {
    readonly isPending: boolean
    readonly removing?: {
        title: string
        description: string
        confirmLabel: string
        cancelLabel: string
    }
    readonly form?: {
        heading: string
        fields: ServiceFields
        nameLabel: string
        durationLabel: string
        bufferLabel: string
        priceLabel: string
        pricePlaceholder: string
        kindLabel: string
        kindPlaceholder: string
        followupLabel: string
        followupPlaceholder: string
        descriptionLabel: string
        activeLabel: string
        saveLabel: string
        cancelLabel: string
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

/** The commands of the services panel. */
export interface BookingServicesOn {
    readonly add: () => void
    readonly edit: (id: string) => void
    readonly ask: (id: string) => void
    readonly change: (patch: Partial<ServiceFields>) => false | void
    readonly save: () => void
    readonly cancelForm: () => void
    readonly confirmRemove: () => void
    readonly cancelRemove: () => void
}

/** Builds the props supplied to BookingServicesBase. */
export const bookingServicesProps = (connected: ServicesConnected): BookingServicesProps => {
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
export const bookingServicesOn = (connected: ServicesConnected): BookingServicesOn => {
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
    }
}
