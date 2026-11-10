import type { StorageAssetsPort } from "@modules/integrations/object-storage"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"

/** Token of the file store item photos are kept in; the app root binds it to the storage integration, else a store that refuses every file is bound. */
export const INVENTORY_ASSETS: unique symbol = Symbol("domain.inventory.assets")

/** Injects the file store of item photos. Parameter type: StorageAssetsPort. */
export const InjectInventoryAssets = (): TypedParameterDecorator<StorageAssetsPort> =>
    injector<StorageAssetsPort>(INVENTORY_ASSETS)

/** Token of the public address of the API item photo links are built on; empty when the app has none. */
export const INVENTORY_PUBLIC_API_URL: unique symbol = Symbol("domain.inventory.public-api-url")

/** Injects the public address of the API, or an empty text when none is set. Parameter type: string. */
export const InjectInventoryPublicApiUrl = (): TypedParameterDecorator<string> =>
    injector<string>(INVENTORY_PUBLIC_API_URL)
