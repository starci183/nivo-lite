"use client"

import { useBookingBoard } from "@/hooks/bookingBoard"
import { useFormatter, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { useMutateRemoveBookingServiceSwr, useMutateSaveBookingServiceSwr } from "@/hooks/swr"
import { useBookingSetupSave } from "@/hooks/bookingSetup"
import { BookingServicesBase } from "./component"
import type { ServiceFields } from "./component"

/** The form being edited: a new service has no id. */
interface Draft {
    readonly id: string | null
    readonly fields: ServiceFields
}

const BLANK: ServiceFields = {
    name: "",
    durationMin: 30,
    bufferMin: 0,
    price: "",
    resourceKind: "",
    followup: "",
    description: "",
    active: true,
}

const digits = (value: string): number | null => {
    const only = value.replace(/[^\d]/gu, "")
    return only === "" ? null : Number(only)
}

/** The connected services list: add, edit and remove the services the shop sells by appointment. */
export const BookingServices = () => {
    const { board } = useBookingBoard()
    const t = useTranslations("workbenchBooking")
    const format = useFormatter()
    const persist = useBookingSetupSave()
    const saveService = useMutateSaveBookingServiceSwr()
    const removeService = useMutateRemoveBookingServiceSwr()
    const [draft, setDraft] = useState<Draft | null>(null)
    const [removeId, setRemoveId] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
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
                    priceVnd: digits(fields.price),
                    resourceKind: fields.resourceKind,
                    followupDays: digits(fields.followup),
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
    return (
        <BookingServicesBase
            props={{
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
                          form: {
                              heading: draft.id === null ? t("serviceAdd") : draft.fields.name,
                              fields: draft.fields,
                              nameLabel: t("serviceName"),
                              durationLabel: t("serviceDuration"),
                              bufferLabel: t("serviceBuffer"),
                              priceLabel: t("servicePrice"),
                              pricePlaceholder: t("servicePricePlaceholder"),
                              kindLabel: t("serviceKind"),
                              kindPlaceholder: t("serviceKindPlaceholder"),
                              followupLabel: t("serviceFollowup"),
                              followupPlaceholder: t("serviceFollowupPlaceholder"),
                              descriptionLabel: t("serviceDescription"),
                              activeLabel: t("serviceActive"),
                              saveLabel: t("save"),
                              cancelLabel: t("cancel"),
                          },
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
            }}
            on={{
                add: () => setDraft({ id: null, fields: BLANK }),
                edit: (id) => {
                    const service = board.services.find((candidate) => candidate.id === id)
                    if (service === undefined) return
                    setDraft({
                        id,
                        fields: {
                            name: service.name,
                            durationMin: service.durationMin,
                            bufferMin: service.bufferMin,
                            price: service.priceVnd === null ? "" : String(service.priceVnd),
                            resourceKind: service.resourceKind ?? "",
                            followup: service.followupDays === null ? "" : String(service.followupDays),
                            description: service.description,
                            active: service.active,
                        },
                    })
                },
                ask: setRemoveId,
                change: (patch) => draft !== null && setDraft({ ...draft, fields: { ...draft.fields, ...patch } }),
                save,
                cancelForm: () => setDraft(null),
                confirmRemove: remove,
                cancelRemove: () => setRemoveId(null),
            }}
        />
    )
}
