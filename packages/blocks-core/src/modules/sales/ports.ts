import type { ListSource } from "@nivo-lite/agent-sdk/block"
import { definePort } from "@nivo-lite/agent-sdk/port"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import type { SalesSettings } from "../../rules/sales/settings"
import type { LeadPatch, LeadRow, OrderPatch, OrderRow, StoreResult, WaitingPage } from "./sales.types"

/** The lead entity as the Sales reads and actions use it; the host swaps it for the entity engine port in one place. */
export interface LeadStore {
    /** The lead, or null when the workspace has none with that id. */
    readonly get: (id: string) => Promise<LeadRow | null>
    /** Writes the patch when the lead is still at the version `expected`; a stale version is a conflict. */
    readonly update: (id: string, expected: string, patch: LeadPatch) => Promise<StoreResult<LeadRow>>
    /** The names of the given leads, by id; a lead that does not exist has no entry. */
    readonly names: (ids: ReadonlyArray<string>) => Promise<Readonly<Record<string, string>>>
    /** The open customers who wait for an answer, longest wait first, at most `limit`. */
    readonly awaitingReply: (limit: number) => Promise<ReadonlyArray<LeadRow>>
}

/** The order entity as the Sales reads and actions use it. */
export interface OrderStore {
    /** The order, or null when the workspace has none with that id. */
    readonly get: (id: string) => Promise<OrderRow | null>
    /** Writes the patch when the order is still at the version `expected`; a stale version is a conflict. */
    readonly update: (id: string, expected: string, patch: OrderPatch) => Promise<StoreResult<OrderRow>>
    /** The orders of a customer, newest first, at most `limit`. */
    readonly ofLead: (leadId: string, limit: number) => Promise<ReadonlyArray<OrderRow>>
    /**
     * The draft orders that wait for the owner under the settings (at the threshold or above, and with no amount yet when the
     * settings say so), oldest first, at most `limit`, and how many there are.
     */
    readonly waiting: (settings: SalesSettings, limit: number) => Promise<WaitingPage>
    /** The orders whose follow-up step failed, newest first, at most `limit`. */
    readonly failedSteps: (limit: number) => Promise<ReadonlyArray<OrderRow>>
}

/** What the Sales asks of the rights of the member who acts. */
export interface RightsStore {
    /** Whether the member holds the permission; an actor that is no member (the agent) holds none. */
    readonly holds: (memberId: string | null, permission: string) => Promise<boolean>
}

/** The rules the workspace chose for its sales. */
export interface SettingsStore {
    /** The saved settings, or null before the first save. */
    readonly get: () => Promise<SalesSettings | null>
    /** Saves the settings; the settings as saved. */
    readonly save: (settings: SalesSettings) => Promise<SalesSettings>
}

/** The port the leads list runs on. */
export const salesLeadsList: PortDefinition<ListSource<LeadRow>> = definePort<ListSource<LeadRow>>("sales.leads-list")

/** The port the orders list runs on. */
export const salesOrdersList: PortDefinition<ListSource<OrderRow>> =
    definePort<ListSource<OrderRow>>("sales.orders-list")

/** The port of the lead entity. */
export const salesLeadStore: PortDefinition<LeadStore> = definePort<LeadStore>("sales.lead-store")

/** The port of the order entity. */
export const salesOrderStore: PortDefinition<OrderStore> = definePort<OrderStore>("sales.order-store")

/** The port of the rights of the acting member. */
export const salesRights: PortDefinition<RightsStore> = definePort<RightsStore>("sales.rights")

/** The port of the sales settings. */
export const salesSettings: PortDefinition<SettingsStore> = definePort<SettingsStore>("sales.settings")
