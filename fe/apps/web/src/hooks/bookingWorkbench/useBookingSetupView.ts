"use client"
import type { useBookingBoard } from "@/hooks/bookingBoard"
import { useBookingServicesView } from "./useBookingServicesView"
import { useBookingResourcesView } from "./useBookingResourcesView"
import { useBookingExceptionsView } from "./useBookingExceptionsView"
import { useBookingPolicyFormView } from "./useBookingPolicyFormView"
import { useBookingPublicPageFormView } from "./useBookingPublicPageFormView"
/** Owns the five actual setup controllers and projects their atomic commands to the ready form contracts. */
export const useBookingSetupView = (isActive: boolean, scope: string, board: ReturnType<typeof useBookingBoard>) => {
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
