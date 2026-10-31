import { MODULE_CATALOG } from "@modules/domain/modules"
import type { KnowledgeAudience, KnowledgeView, ViewRequest } from "./agent-knowledge.contracts"

/**
 * Marketing modules publish what they write (social posts, videos), so they read PUBLIC knowledge only, whatever the module catalog
 * says about their audience. Add a module here when its output is published or reaches people outside the business.
 */
const PUBLIC_ONLY_MODULES: ReadonlySet<string> = new Set(["content", "video"])

/**
 * Who a module talks to, from the typed catalog: a customer-facing module (and a publishing one) reads the public view only, and a key
 * the catalog does not know gets the narrower customer view.
 */
export const audienceOfModule = (module: string): KnowledgeAudience => {
    const entry = MODULE_CATALOG.find((candidate) => candidate.key === module)
    return PUBLIC_ONLY_MODULES.has(module) || entry === undefined || entry.audience === "customer"
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

/** The knowledge folder of a module key, or null when the key is not a module of the catalog. */
export const knowledgeFolderOf = (module: string): string | null =>
    MODULE_CATALOG.find((entry) => entry.key === module)?.knowledgeFolder ?? null
