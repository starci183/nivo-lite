import type { BadgeTone } from "@starci/grammar/common"
import type { BookingAgendaRowView, ResourceFields } from "./booking"
import type { WorkbenchDashboardRegions, WorkbenchExplanationView, WorkbenchFigureRegion } from "./workbench-dashboard"
import type { SlotPanelProps } from "./slot"
type BookingPlacementFields = {
    readonly serviceId: string
    readonly date: string
    readonly time: string
    readonly resourceId: string
    readonly name: string
    readonly phone: string
    readonly party: number
    readonly note: string
    readonly force: boolean
}
/** BookingPlacementData resolved data. */
export interface BookingPlacementData {
    readonly mode: "add" | "move"
    readonly title: string
    readonly fields: BookingPlacementFields
    readonly serviceOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly resourceOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly labels: {
        readonly name: string
        readonly phone: string
        readonly service: string
        readonly date: string
        readonly time: string
        readonly resource: string
        readonly party: string
        readonly note: string
        readonly notePlaceholder: string
        readonly force: string
        readonly save: string
        readonly cancel: string
        readonly close: string
    }
    readonly refusal?: string
    readonly canForce: boolean
    readonly isPending: boolean
}
/** BookingDetailData resolved data. */
/** BookingDetailFact resolved data. */
export interface BookingDetailFact {
    readonly id: string
    readonly term: string
    readonly description: string
}

/** Provides the selected booking details and available next action. */
export interface BookingDetailData {
    readonly title: string
    readonly description: string
    readonly closeLabel: string
    readonly statusLabel: string
    readonly customerLabel: string
    readonly statusTone: BadgeTone
    readonly items: ReadonlyArray<BookingDetailFact>
    readonly customerHref?: string
    readonly next?: { readonly id: string; readonly label: string }
    readonly actions: ReadonlyArray<{
        readonly id: string
        readonly label: string
        readonly intent: "neutral" | "destructive"
    }>
    readonly isPending: boolean
}
/** BookingDeskData resolved data. */
export interface BookingDeskData {
    readonly label: string
    readonly legend: ReadonlyArray<{ readonly text: string; readonly tone: BadgeTone }>
    readonly add: { readonly label: string; readonly isDisabled: boolean }
    readonly nav?: {
        readonly prevLabel: string
        readonly nextLabel: string
        readonly thisWeekLabel: string
        readonly dateLabel: string
        readonly date: string
        readonly showCancelledLabel: string
        readonly rangeText: string
        readonly showCancelled: boolean
    }
    readonly notice?: {
        readonly tone: "affirmative" | "negative"
        readonly text: string
        readonly dismissLabel: string
    }
    readonly days: ReadonlyArray<{
        readonly id: string
        readonly label: string
        readonly rows: ReadonlyArray<BookingAgendaRowView>
    }>
    readonly empty: { readonly title: string; readonly body: string }
    readonly isPending: boolean
    readonly detail?: BookingDetailData
    readonly placement?: BookingPlacementData
    readonly cancel?: { readonly title: string; readonly confirmLabel: string; readonly keepLabel: string }
}
/** BookingCatalogData resolved data. */
export interface BookingCatalogData {
    readonly label: string
    readonly emptyText: string
    readonly editLabel: string
    readonly removeLabel: string
    readonly rows: ReadonlyArray<{ readonly id: string; readonly title: string; readonly detail: string }>
}
/** BookingRemovalData resolved data. */
export interface BookingRemovalData {
    readonly title: string
    readonly description: string
    readonly confirmLabel: string
    readonly cancelLabel: string
}
/** BookingServiceFormData resolved data. */
export interface BookingServiceFormData {
    readonly heading: string
    readonly nameLabel: string
    readonly durationLabel: string
    readonly bufferLabel: string
    readonly priceLabel: string
    readonly pricePlaceholder: string
    readonly kindLabel: string
    readonly kindPlaceholder: string
    readonly followupLabel: string
    readonly followupPlaceholder: string
    readonly descriptionLabel: string
    readonly activeLabel: string
    readonly saveLabel: string
    readonly cancelLabel: string
    readonly fields: BookingServiceFieldsData
}
/** BookingServicesData resolved data. */
export interface BookingServicesData {
    readonly title: string
    readonly hint: string
    readonly addLabel: string
    readonly list: BookingCatalogData
    readonly form?: BookingServiceFormData
    readonly removing?: BookingRemovalData
    readonly isPending: boolean
}
/** BookingResourcesData resolved data. */
export interface BookingResourcesData {
    readonly title: string
    readonly hint: string
    readonly addLabel: string
    readonly list: BookingCatalogData
    readonly form?: {
        readonly heading: string
        readonly nameLabel: string
        readonly kindLabel: string
        readonly capacityLabel: string
        readonly activeLabel: string
        readonly staffLabel: string
        readonly hoursHeading: string
        readonly hoursHint: string
        readonly hoursPlaceholder: string
        readonly saveLabel: string
        readonly saveHoursLabel: string
        readonly cancelLabel: string
        readonly fields: ResourceFields
        readonly staffOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly hours: ReadonlyArray<{ readonly day: number; readonly label: string; readonly value: string }>
        readonly canSaveHours: boolean
    }
    readonly removing?: BookingRemovalData
    readonly isPending: boolean
    readonly notice?: { readonly tone: "affirmative" | "negative"; readonly text: string }
}
/** BookingExceptionsData resolved data. */
export interface BookingExceptionsData {
    readonly title: string
    readonly hint: string
    readonly removeLabel: string
    readonly appliesLabel: string
    readonly dateLabel: string
    readonly noteLabel: string
    readonly notePlaceholder: string
    readonly closedLabel: string
    readonly startLabel: string
    readonly endLabel: string
    readonly addLabel: string
    readonly rows: ReadonlyArray<{ readonly id: string; readonly title: string; readonly detail: string }>
    readonly fields: BookingExceptionFieldsData
    readonly applies: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly isPending: boolean
}
/** BookingPolicyData resolved data. */
export interface BookingPolicyData {
    readonly title: string
    readonly hint: string
    readonly addressLabel: string
    readonly address: string
    readonly autoConfirmLabel: string
    readonly handoffLabel: string
    readonly saveLabel: string
    readonly rules: ReadonlyArray<{ readonly id: string; readonly label: string; readonly value: number }>
    readonly autoConfirm: boolean
    readonly handoff: boolean
    readonly isPending: boolean
}
/** BookingPublicPageData resolved data. */
export interface BookingPublicPageData {
    readonly title: string
    readonly hint: string
    readonly enabledLabel: string
    readonly slugLabel: string
    readonly slug: string
    readonly slugPlaceholder: string
    readonly noteLabel: string
    readonly note: string
    readonly notePlaceholder: string
    readonly saveLabel: string
    readonly enabled: boolean
    readonly link?: { readonly label: string; readonly href: string; readonly hint: string }
    readonly isPending: boolean
}
/** BookingSetupData resolved data. */
export interface BookingSetupData {
    readonly services: BookingServicesData
    readonly resources: BookingResourcesData
    readonly exceptions: BookingExceptionsData
    readonly policy: BookingPolicyData
    readonly publicPage: BookingPublicPageData
}
/** BookingWaitlistData resolved data. */
export interface BookingWaitlistData {
    readonly label: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly removeLabel: string
    readonly rows: ReadonlyArray<{ readonly id: string; readonly title: string; readonly detail: string }>
    readonly isPending: boolean
}
/** BookingStatisticsData resolved data. */
export interface BookingStatisticsData {
    readonly rangeText: string
    readonly label: string
    readonly utilisationLabel: string
    readonly utilisationEmpty: string
    readonly stats: ReadonlyArray<{
        readonly id: string
        readonly term: string
        readonly value: string
        readonly unit?: string
    }>
    readonly resources: ReadonlyArray<{
        readonly id: string
        readonly name: string
        readonly pct: number
        readonly valueLabel: string
        readonly hoursText: string
    }>
}
/** BookingWorkbenchDataView resolved data. */
export interface BookingWorkbenchDataView {
    readonly why: WorkbenchExplanationView
    readonly regions: WorkbenchDashboardRegions
    readonly tabsLabel: string
    readonly selectedTab: string
    readonly tabs: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly ribbon: WorkbenchFigureRegion
    readonly desk: SlotPanelProps<BookingDeskData>
    readonly panel: SlotPanelProps<{
        readonly waitlist: BookingWaitlistData
        readonly stats: BookingStatisticsData
        readonly setup: BookingSetupData
    }>
}
/** BookingDeskActions resolved data. */
export interface BookingDeskActions {
    readonly onAdd: () => void
    readonly onPlacementChange: (patch: Partial<BookingPlacementFields>) => void
    readonly onPlacementSubmit: () => void
    readonly onPlacementClose: () => void
    readonly onPrev: () => void
    readonly onNext: () => void
    readonly onThisWeek: () => void
    readonly onPickDate: (date: string) => void
    readonly onToggleCancelled: (value: boolean) => void
    readonly onDismissNotice: () => void
    readonly onOpen: (id: string) => void
    readonly onAct: (id: string, action: string) => void
    readonly onConfirmCancel: () => void
    readonly onKeepBooking: () => void
    readonly onDetailAction: (id: string) => void
    readonly onCloseDetail: () => void
}
/** BookingServicesActions resolved data. */
export interface BookingServicesActions {
    readonly onAdd: () => void
    readonly onEdit: (id: string) => void
    readonly onAsk: (id: string) => void
    readonly onChange: (patch: Partial<BookingServiceFieldsData>) => void
    readonly onSave: () => void
    readonly onCancelForm: () => void
    readonly onConfirmRemove: () => void
    readonly onCancelRemove: () => void
}
/** BookingResourcesActions resolved data. */
export interface BookingResourcesActions {
    readonly onAdd: () => void
    readonly onEdit: (id: string) => void
    readonly onAsk: (id: string) => void
    readonly onChange: (patch: Partial<ResourceFields>) => void
    readonly onChangeHours: (day: number, value: string) => void
    readonly onSave: () => void
    readonly onSaveHours: () => void
    readonly onCancelForm: () => void
    readonly onConfirmRemove: () => void
    readonly onCancelRemove: () => void
}
/** BookingWorkbenchActions resolved data. */
export interface BookingWorkbenchActions {
    readonly selectTab: (key: string) => void
    readonly closeWhy: () => void
    readonly retryDashboard: () => void
    readonly retryPanel: () => void
    readonly retryRibbon: () => void
    readonly retryDesk: () => void
    readonly desk: BookingDeskActions
    readonly waitlist: { readonly onRemove: (id: string) => void }
    readonly setup: {
        readonly services: BookingServicesActions
        readonly resources: BookingResourcesActions
        readonly exceptions: {
            readonly onChange: (patch: Partial<BookingExceptionFieldsData>) => void
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
/** BookingExceptionsActions resolved data. */
export interface BookingExceptionsActions {
    readonly onChange: (patch: Partial<BookingExceptionFieldsData>) => void
    readonly onAdd: () => void
    readonly onRemove: (id: string) => void
}
/** BookingPolicyActions resolved data. */
export interface BookingPolicyActions {
    readonly onChangeRule: (id: string, value: number) => void
    readonly onChangeAddress: (value: string) => void
    readonly onToggleAutoConfirm: (value: boolean) => void
    readonly onToggleHandoff: (value: boolean) => void
    readonly onSave: () => void
}
/** BookingPublicPageActions resolved data. */
export interface BookingPublicPageActions {
    readonly onToggleEnabled: (value: boolean) => void
    readonly onChangeSlug: (value: string) => void
    readonly onChangeNote: (value: string) => void
    readonly onSave: () => void
}
/** BookingWaitlistActions resolved data. */
export interface BookingWaitlistActions {
    readonly onRemove: (id: string) => void
}
/** Holds editable service settings before a booking service is saved. */
export interface BookingServiceFieldsData {
    readonly name: string
    readonly durationMin: number
    readonly bufferMin: number
    readonly price: string
    readonly resourceKind: string
    readonly followup: string
    readonly description: string
    readonly active: boolean
}
/** Holds resource closure and opening hours before an exception is saved. */
export interface BookingExceptionFieldsData {
    readonly resourceId: string
    readonly date: string
    readonly closed: boolean
    readonly start: string
    readonly end: string
    readonly note: string
}

/** The original workbench areas in route and display order. */
export const BOOKING_TABS = ["calendar", "today", "waitlist", "stats", "setup"] as const
