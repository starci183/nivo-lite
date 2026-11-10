import { InventoryError, InventoryErrorCode } from "./errors/inventory.error"
import type { StorageAssetsPort } from "@modules/integrations/object-storage"

const refusal = (): Error => new InventoryError({ code: InventoryErrorCode.ItemImageNotStored })

/** The file store of an app whose root bound none: it holds no file and takes none, so a photo is never lost silently. */
export const UNBOUND_ASSETS: StorageAssetsPort = {
    download: () => Promise.resolve({ data: null, error: refusal() }),
    upload: () => Promise.resolve({ error: refusal() }),
}
