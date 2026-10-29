import type { StorageObjectsPort } from "@modules/integrations/object-storage"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"

/** Token of the storage door the composition root hands to the knowledge-sources capability, exported so a spec can provide it. */
export const KNOWLEDGE_STORAGE: unique symbol = Symbol("domain.knowledge-sources.storage")

/** Injects the storage door. Parameter type: StorageObjectsPort. */
export const InjectKnowledgeStorage = (): TypedParameterDecorator<StorageObjectsPort> =>
    injector<StorageObjectsPort>(KNOWLEDGE_STORAGE)
