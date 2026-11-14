/** The schema name an enterprise seed document carries. */
export const ENTERPRISE_SEED_SCHEMA = "nivo/enterprise-seed@1"

/** Where an enterprise is seeded: nowhere, only on the local stack, only in production, or in both. */
export const ENTERPRISE_SEED_TARGETS = ["off", "local", "prod", "both"] as const

/** The target of one enterprise. */
export type EnterpriseSeedTarget = (typeof ENTERPRISE_SEED_TARGETS)[number]

/** One place a stack runs: the local stack (`dev`) or production (`production`). */
export type EnterpriseSeedPlace = "local" | "prod"

/**
 * One enterprise, checked: its FOUNDATION only. An enterprise workspace is an ordinary workspace that also carries one unique string
 * identifier; the seed declares that workspace, where it is seeded and whose owner owns it. It never holds data made by using the product
 * (conversations, leads, orders, runs, documents and truths, CRM records, connected accounts, decisions).
 */
export interface EnterpriseSeed {
    /** The unique string identifier of the enterprise (`nivo-web`); an ordinary workspace has its uuid only. */
    readonly identifier: string
    /** Where it is seeded; `off` seeds it nowhere. */
    readonly target: EnterpriseSeedTarget
    /** The display name of its workspace. */
    readonly workspaceName: string
    /** The name of the existing workspace whose owner also owns the enterprise workspace. */
    readonly ownerWorkspace: string
}

/** An enterprise seed document as its file holds it: the enterprise and the schema name. */
export interface EnterpriseSeedDocument extends EnterpriseSeed {
    /** The schema name. */
    readonly schema: typeof ENTERPRISE_SEED_SCHEMA
}
