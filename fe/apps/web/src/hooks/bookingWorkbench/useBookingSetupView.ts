"use client"
import type { useBookingBoard } from "@/hooks/bookingBoard"
import { useBookingServicesView } from "./useBookingServicesView"
import type { ExceptionFields, ServiceFields } from "@/modules/booking-desk"
import type { ResourceFields } from "@/modules/types"
import type { BookingServicesProps } from "@/hooks/bookingServicesView"
import type { BookingResourcesProps } from "@/hooks/bookingResourcesView"
import { useBookingResourcesView } from "./useBookingResourcesView"
import { useBookingExceptionsView, type BookingExceptionsView } from "./useBookingExceptionsView"
import { useBookingPolicyFormView, type BookingPolicyFormView } from "./useBookingPolicyFormView"
import { useBookingPublicPageFormView, type BookingPublicPageFormView } from "./useBookingPublicPageFormView"

/** The view `useBookingSetupView` returns. */
export interface BookingSetupView {
    readonly props: {
        readonly services: BookingServicesProps
        readonly resources: BookingResourcesProps
        readonly exceptions: BookingExceptionsView["props"]
        readonly policy: BookingPolicyFormView["props"]
        readonly publicPage: BookingPublicPageFormView["props"]
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
