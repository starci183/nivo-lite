import type { DecisionVerdict, WireEdits } from "@modules/domain/decisions"
import type { Locale } from "@modules/platform/i18n"

/** A caller's scope for Sales commands. */
export interface SalesScope {
    /** The active workspace. */
    readonly workspaceId: string
    /** The language of evidence text. */
    readonly locale: Locale
}

/** A retry, stop or Accounting handoff. */
export interface SalesItemRequest extends SalesScope {
    /** The work item or order. */
    readonly id: string
}

/** A person's decision on a Sales work item. */
export interface SalesDecisionRequest extends SalesItemRequest {
    /** Approve or reject. */
    readonly decision: DecisionVerdict
    /** Changes made before approving. */
    readonly edits?: WireEdits
    /** A written note. */
    readonly note?: string
    /** The written basis for a financial decision. */
    readonly basis?: string
}

/** A person's decision on a legacy draft card. */
export interface SalesDraftRequest extends SalesItemRequest {
    /** Approve or reject. */
    readonly decision: DecisionVerdict
    /** The edited draft, when changed. */
    readonly editedDraft?: string
}

/** A shipment to record once. */
export interface SalesShipmentRequest extends SalesScope {
    /** The order. */
    readonly orderId: string
    /** The carrier. */
    readonly carrier: string
    /** The carrier's tracking code. */
    readonly trackingCode: string
}

/** A queued action, with the id the status query polls. */
export interface SalesAction {
    /** The pgmq outbox identity. */
    readonly id: string
    /** The normalized lifecycle. */
    readonly status: string
    /** The work item to refresh after completion. */
    readonly workItemId: string | null
    /** A stable failure code, without prose. */
    readonly errorCode: string | null
}

/** The recorded shipment. */
export interface SalesShipment {
    /** The order. */
    readonly id: string
    /** Its human-readable number. */
    readonly orderNo: string
    /** The queued notification, pollable through salesActionStatus. */
    readonly notificationId: string
}
