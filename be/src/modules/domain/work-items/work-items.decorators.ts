import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { WorkItemsLeadDirectory } from "./work-items.port"

/** Token of the lead directory port; the app root binds it to the leads capability. */
export const WORK_ITEMS_LEADS: unique symbol = Symbol("domain.work-items.leads")

/** Injects the lead directory port. Parameter type: WorkItemsLeadDirectory. */
export const InjectWorkItemsLeads = (): TypedParameterDecorator<WorkItemsLeadDirectory> =>
    injector<WorkItemsLeadDirectory>(WORK_ITEMS_LEADS)
