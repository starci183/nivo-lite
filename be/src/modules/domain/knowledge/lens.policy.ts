import type { Audience, Lens, LensRequest } from "./knowledge.contracts"

/**
 * Marketing modules publish what they write (social posts, videos), so they read PUBLIC knowledge only, whatever the module registry
 * says about their audience. Add a module here when its output is published or reaches people outside the business.
 */
const PUBLIC_ONLY_MODULES: ReadonlySet<string> = new Set(["content", "video"])

/** Whether a lens of this request sees public knowledge only. */
const seesPublicOnly = (request: LensRequest): boolean =>
    PUBLIC_ONLY_MODULES.has(request.module) ||
    request.moduleAudience === "customer" ||
    request.requestedAudience === "customer"

/**
 * THE LENS: what an agent may read of the business knowledge. A caller can only narrow the view of its module (a customer-facing reply
 * passes audience "customer"), never widen it. `installationId` scopes it to one agent instance: the shared knowledge plus that
 * instance's own (default: shared only).
 */
export const lensOf = (request: LensRequest): Lens => {
    const audience: Audience = seesPublicOnly(request) ? "customer" : "internal"
    return {
        workspaceId: request.workspaceId,
        module: request.module,
        audience,
        installationId: request.installationId ?? null,
    }
}

/** What a document or fact carries that the lens judges. */
export interface Scoped {
    /** The module it is for; null = every module. */
    readonly module: string | null
    /** The agent instance it is kept for; null = every instance. */
    readonly installationId: string | null
}

/** Defence in depth for a row the SQL filters already narrowed: the same module and instance rule, in code. */
export const isInLens = (lens: Lens, item: Scoped): boolean =>
    (item.module === null || item.module === lens.module) &&
    (item.installationId === null || item.installationId === lens.installationId)
