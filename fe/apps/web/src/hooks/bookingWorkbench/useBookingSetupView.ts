"use client"
import type { useBookingBoard } from "@/hooks/bookingBoard"
import { useBookingServicesView } from "./useBookingServicesView"
import { useBookingResourcesView } from "./useBookingResourcesView"
import { useBookingExceptionsView } from "./useBookingExceptionsView"
import { useBookingPolicyFormView } from "./useBookingPolicyFormView"
import { useBookingPublicPageFormView } from "./useBookingPublicPageFormView"
import type { ServiceFields, ExceptionFields } from "@/modules/booking-desk"
import type { ResourceFields } from "@/modules/types"
/** The view `useBookingSetupView` returns. */
export interface BookingSetupView {
    readonly props: {
        readonly services: {
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
        readonly resources: {
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
        readonly exceptions: {
            title: string
            hint: string
            rows: {
                id: string
                title: string
                detail: string
            }[]
            removeLabel: string
            fields: ExceptionFields
            appliesLabel: string
            applies: {
                id: string
                label: string
            }[]
            dateLabel: string
            noteLabel: string
            notePlaceholder: string
            closedLabel: string
            startLabel: string
            endLabel: string
            addLabel: string
            isPending: boolean
        }
        readonly policy: {
            readonly title: string
            readonly hint: string
            readonly rules: {
                id:
                    | "cancelWindowHours"
                    | "depositPct"
                    | "lateCancelFeePct"
                    | "maxAdvanceDays"
                    | "minLeadMin"
                    | "noShowFeeVnd"
                    | "slotStepMin"
                label: string
                value: number
            }[]
            readonly addressLabel: string
            readonly address: string
            readonly autoConfirmLabel: string
            readonly autoConfirm: boolean
            readonly handoffLabel: string
            readonly handoff: boolean
            readonly saveLabel: string
            readonly isPending: boolean
        }
        readonly publicPage: {
            readonly saveLabel: string
            readonly isPending: boolean
            readonly link?: {
                label: string
                href: string
                hint: string
            }
            readonly title: string
            readonly hint: string
            readonly enabledLabel: string
            readonly enabled: boolean
            readonly slugLabel: string
            readonly slug: string
            readonly slugPlaceholder: string
            readonly noteLabel: string
            readonly note: string
            readonly notePlaceholder: string
        }
    }
    readonly on: {
        readonly services: {
            readonly onAdd: () => void
            readonly onEdit: (id: string) => void
            readonly onAsk: (id: string) => void
            readonly onChange: (patch: Partial<ServiceFields>) => false | void
            readonly onSave: () => void
            readonly onCancelForm: () => void
            readonly onConfirmRemove: () => void
            readonly onCancelRemove: () => void
        }
        readonly resources: {
            readonly onAdd: () => void
            readonly onEdit: (id: string) => void
            readonly onAsk: (id: string) => void
            readonly onChange: (patch: Partial<ResourceFields>) => false | void
            readonly onChangeHours: (day: number, value: string) => false | void
            readonly onSave: () => void
            readonly onSaveHours: () => void
            readonly onCancelForm: () => void
            readonly onConfirmRemove: () => void
            readonly onCancelRemove: () => void
        }
        readonly exceptions: {
            readonly onChange: (patch: Partial<ExceptionFields>) => void
            readonly onAdd: () => void
            readonly onRemove: (id: string) => void
        }
        readonly policy: {
            readonly onChangeRule: (id: string, value: number) => void
            readonly onChangeAddress: (value: string) => void
            readonly onToggleAutoConfirm: (value: boolean) => void
            readonly onToggleHandoff: (value: boolean) => void
            readonly onSave: () => void
        }
        readonly publicPage: {
            readonly onToggleEnabled: (value: boolean) => void
            readonly onChangeSlug: (value: string) => void
            readonly onChangeNote: (value: string) => void
            readonly onSave: () => void
        }
    }
}

/** Owns the five actual setup controllers and projects their atomic commands to the ready form contracts. */
export const useBookingSetupView = (
    isActive: boolean,
    scope: string,
    board: ReturnType<typeof useBookingBoard>,
): BookingSetupView => {
    const services = useBookingServicesView(isActive, scope, board)
    const resources = useBookingResourcesView(isActive, scope, board)
    const exceptions = useBookingExceptionsView(isActive, scope, board)
    const policy = useBookingPolicyFormView(isActive, scope, board)
    const publicPage = useBookingPublicPageFormView(isActive, scope, board)
    return {
        props: {
            services: services.props,
            resources: resources.props,
            exceptions: exceptions.props,
            policy: policy.props,
            publicPage: publicPage.props,
        },
        on: {
            services: {
                onAdd: services.on.add,
                onEdit: services.on.edit,
                onAsk: services.on.ask,
                onChange: services.on.change,
                onSave: services.on.save,
                onCancelForm: services.on.cancelForm,
                onConfirmRemove: services.on.confirmRemove,
                onCancelRemove: services.on.cancelRemove,
            },
            resources: {
                onAdd: resources.on.add,
                onEdit: resources.on.edit,
                onAsk: resources.on.ask,
                onChange: resources.on.change,
                onChangeHours: resources.on.changeHours,
                onSave: resources.on.save,
                onSaveHours: resources.on.saveHours,
                onCancelForm: resources.on.cancelForm,
                onConfirmRemove: resources.on.confirmRemove,
                onCancelRemove: resources.on.cancelRemove,
            },
            exceptions: { onChange: exceptions.on.change, onAdd: exceptions.on.add, onRemove: exceptions.on.remove },
            policy: {
                onChangeRule: policy.on.changeRule,
                onChangeAddress: policy.on.changeAddress,
                onToggleAutoConfirm: policy.on.toggleAutoConfirm,
                onToggleHandoff: policy.on.toggleHandoff,
                onSave: policy.on.save,
            },
            publicPage: {
                onToggleEnabled: publicPage.on.toggleEnabled,
                onChangeSlug: publicPage.on.changeSlug,
                onChangeNote: publicPage.on.changeNote,
                onSave: publicPage.on.save,
            },
        },
    } as const
}
