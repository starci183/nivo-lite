/**
 * The inventory capability takes one option, set by the app root: the seed mode (the cli app) registers the seed write of catalogue
 * items alone, with no member-facing service and no inventory job.
 */
export interface InventoryOptions {
    /** True registers the seed mode; absent or false, the full capability. */
    readonly seedOnly?: boolean
}
