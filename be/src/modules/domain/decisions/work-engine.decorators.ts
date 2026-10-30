import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type {
    InboundEventStatus,
    LeadDirectory,
    LeadGenFlow,
    ModuleCatalogSource,
    OutboundAccessGate,
    ThreadWorkHistory,
    WorkChainsHistory,
    WorkThreadsHistory,
} from "./work-engine.port"

/** Token of the inbound event status port; the app root binds it to the inbox capability. */
export const INBOUND_EVENT_STATUS: unique symbol = Symbol("domain.decisions.inbound-event-status")

/** Token of the lead generation flow port. */
export const LEAD_GEN_FLOW: unique symbol = Symbol("domain.decisions.lead-gen-flow")

/** Token of the lead directory port. */
export const LEAD_DIRECTORY: unique symbol = Symbol("domain.decisions.lead-directory")

/** Token of the outbound access port. */
export const OUTBOUND_ACCESS_GATE: unique symbol = Symbol("domain.decisions.outbound-access-gate")

/** Injects the inbound event status port. Parameter type: InboundEventStatus. */
export const InjectInboundEventStatus = (): TypedParameterDecorator<InboundEventStatus> =>
    injector<InboundEventStatus>(INBOUND_EVENT_STATUS)

/** Injects the lead generation flow port. Parameter type: LeadGenFlow. */
export const InjectLeadGenFlow = (): TypedParameterDecorator<LeadGenFlow> => injector<LeadGenFlow>(LEAD_GEN_FLOW)

/** Injects the outbound access port. Parameter type: OutboundAccessGate. */
export const InjectOutboundAccessGate = (): TypedParameterDecorator<OutboundAccessGate> =>
    injector<OutboundAccessGate>(OUTBOUND_ACCESS_GATE)

/** Injects the lead directory port. Parameter type: LeadDirectory. */
export const InjectLeadDirectory = (): TypedParameterDecorator<LeadDirectory> => injector<LeadDirectory>(LEAD_DIRECTORY)

/** Token of the module catalogue port. */
export const MODULE_CATALOG_SOURCE: unique symbol = Symbol("domain.decisions.module-catalog-source")

/** Injects the module catalogue port. Parameter type: ModuleCatalogSource. */
export const InjectModuleCatalogSource = (): TypedParameterDecorator<ModuleCatalogSource> =>
    injector<ModuleCatalogSource>(MODULE_CATALOG_SOURCE)

/** Token of the thread work history port. */
export const THREAD_WORK_HISTORY: unique symbol = Symbol("domain.decisions.thread-work-history")

/** Token of the work chains history port. */
export const WORK_CHAINS_HISTORY: unique symbol = Symbol("domain.decisions.work-chains-history")

/** Token of the work threads history port. */
export const WORK_THREADS_HISTORY: unique symbol = Symbol("domain.decisions.work-threads-history")

/** Injects the thread work history port. Parameter type: ThreadWorkHistory. */
export const InjectThreadWorkHistory = (): TypedParameterDecorator<ThreadWorkHistory> =>
    injector<ThreadWorkHistory>(THREAD_WORK_HISTORY)

/** Injects the work chains history port. Parameter type: WorkChainsHistory. */
export const InjectWorkChainsHistory = (): TypedParameterDecorator<WorkChainsHistory> =>
    injector<WorkChainsHistory>(WORK_CHAINS_HISTORY)

/** Injects the work threads history port. Parameter type: WorkThreadsHistory. */
export const InjectWorkThreadsHistory = (): TypedParameterDecorator<WorkThreadsHistory> =>
    injector<WorkThreadsHistory>(WORK_THREADS_HISTORY)
