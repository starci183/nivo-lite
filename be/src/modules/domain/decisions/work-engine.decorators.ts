import { WORK_ITEM_CLOSED } from "@modules/domain/work-items"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type {
    InboundEventStatus,
    ModuleCatalogSource,
    OutboundAccessGate,
    WorkItemClosedHook,
} from "./work-engine.port"

/** Token of the inbound event status port; the app root binds it to the inbox capability. */
export const INBOUND_EVENT_STATUS: unique symbol = Symbol("domain.decisions.inbound-event-status")

/** Token of the outbound access port. */
export const OUTBOUND_ACCESS_GATE: unique symbol = Symbol("domain.decisions.outbound-access-gate")

/** Injects the inbound event status port. Parameter type: InboundEventStatus. */
export const InjectInboundEventStatus = (): TypedParameterDecorator<InboundEventStatus> =>
    injector<InboundEventStatus>(INBOUND_EVENT_STATUS)

/** Injects the outbound access port. Parameter type: OutboundAccessGate. */
export const InjectOutboundAccessGate = (): TypedParameterDecorator<OutboundAccessGate> =>
    injector<OutboundAccessGate>(OUTBOUND_ACCESS_GATE)

/** Token of the module catalogue port. */
export const MODULE_CATALOG_SOURCE: unique symbol = Symbol("domain.decisions.module-catalog-source")

/** Injects the module catalogue port. Parameter type: ModuleCatalogSource. */
export const InjectModuleCatalogSource = (): TypedParameterDecorator<ModuleCatalogSource> =>
    injector<ModuleCatalogSource>(MODULE_CATALOG_SOURCE)

/** Injects the closed-item hook. Parameter type: WorkItemClosedHook. */
export const InjectWorkItemClosed = (): TypedParameterDecorator<WorkItemClosedHook> =>
    injector<WorkItemClosedHook>(WORK_ITEM_CLOSED)
