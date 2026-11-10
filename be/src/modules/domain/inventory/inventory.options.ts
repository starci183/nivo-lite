import type { InjectionToken } from "@nestjs/common"

/**
 * The inventory capability takes options set by the app root: the seed mode (the cli app) registers the seed write of catalogue
 * items alone, with no member-facing service and no inventory job; `assets` binds the file store item photos are kept in, and
 * `publicApiUrl` is the public address of the API that photo links are built on.
 */
export interface InventoryOptions {
    /** True registers the seed mode; absent or false, the full capability. */
    readonly seedOnly?: boolean
    /** The provider token of the file store (a `StorageAssetsPort`) item photos are written to and read from; without it items have no photos. */
    readonly assets?: InjectionToken
    /** The public address of the API (`PUBLIC_API_URL`); without it the photo of an item has no link. */
    readonly publicApiUrl?: string | undefined
}
