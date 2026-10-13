import type { Locale } from "@modules/platform/i18n"

/** The channels the Inbox simulator presents. */
export type SimulationChannel = "zalo" | "facebook" | "email" | "phone" | "bank" | "manual"

/** The inputs for which the simulator starts department work. */
export type SimulationKind = "message" | "order" | "payment"

/** A bounded request to record a simulated input and queue its department work. */
export interface InboxSimulationInput {
    /** The displayed channel. */
    readonly channel: SimulationChannel
    /** The department work to start. */
    readonly kind: SimulationKind
    /** The customer's name. */
    readonly senderName: string
    /** The customer's contact, when supplied. */
    readonly senderContact?: string | null
    /** The customer's words. */
    readonly body?: string | null
    /** The amount in VND, rounded to whole VND when recorded. */
    readonly amountVnd?: number | null
    /** The order or bank reference, when supplied. */
    readonly externalRef?: string | null
    /** The items in an order. */
    readonly items?: string | null
    /** The channel's event identity; a repeat is a duplicate. */
    readonly eventId?: string | null
    /** The accepted language of the caller. */
    readonly locale: Locale
}

/** The queue states as the browser's polling contract presents them. */
export type SimulationStatus = "queued" | "running" | "succeeded" | "failed"

/** The immediate receipt of a simulated input. */
export interface InboxSimulationReceipt {
    /** The stored inbound event, used to poll the status. */
    readonly id: string
    /** The current queue state. */
    readonly status: SimulationStatus
    /** True when this channel event was already recorded. */
    readonly duplicate: boolean
}

/** The event facts the simulator's result notice needs. */
export interface SimulationEvent {
    /** The stored inbound event. */
    readonly id: string
    /** The channel's own event identity. */
    readonly eventId: string
    /** How many repeated deliveries were counted. */
    readonly duplicateCount: number
    /** The amount in whole VND, when supplied. */
    readonly amountVnd: number | null
    /** The lead the department created, when any. */
    readonly leadId: string | null
    /** The inbound event's recorded state. */
    readonly status: string
}

/** The first department's result, including work that now waits for a person's decision. */
export interface SimulationWorkItem {
    /** The work item. */
    readonly id: string
    /** The department shown in the simulator notice. */
    readonly department: string
    /** The work item's recorded state, such as waiting_decision. */
    readonly status: string
}

/** The observable result of the fenced job that handles a simulated input. */
export interface InboxSimulationStatus {
    /** The event identity supplied to the status query. */
    readonly id: string
    /** Whether polling should continue or stop. */
    readonly status: SimulationStatus
    /** A stable failure code; no backend failure prose is exposed. */
    readonly errorCode: string | null
    /** The recorded input, refreshed after processing. */
    readonly event: SimulationEvent
    /** The first department's work, when it has started. */
    readonly workItem: SimulationWorkItem | null
}
