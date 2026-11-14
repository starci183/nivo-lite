import { MODULE_CATALOG } from "@modules/domain/modules"
import type { KnowledgeAudience, KnowledgeView, ViewRequest } from "./agent-knowledge.contracts"

/**
 * Who a module talks to, from the typed catalog: a customer-facing module (and a publishing one) reads the public view only, and a key
 * the catalog does not know gets the narrower customer view.
 */
export const audienceOfModule = (module: string): KnowledgeAudience => {
    const entry = MODULE_CATALOG.find((candidate) => candidate.key === module)
    return entry === undefined || entry.publishes === true || entry.audience === "customer"
        ? "customer"
        : "internal"
}

/**
 * THE VIEW: what an agent may read of the business knowledge. A caller can only narrow the view of its module (a customer-facing reply
 * asks for "customer"), never widen it. `installationId` scopes it to one agent instance: the shared knowledge plus that instance's own.
 */
export const viewOf = (request: ViewRequest): KnowledgeView => ({
    workspaceId: request.workspaceId,
    module: request.module,
    audience:
        audienceOfModule(request.module) === "customer" || request.audience === "customer" ? "customer" : "internal",
    installationId: request.installationId ?? null,
})
