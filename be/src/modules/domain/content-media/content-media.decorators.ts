import type { SupabaseObjectsPort } from "@modules/integrations/supabase"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"

/** Token of the storage door selected by the app root. */
export const CONTENT_MEDIA_STORAGE: unique symbol = Symbol("domain.content-media.storage")

/** Injects the private object storage door. Parameter type: SupabaseObjectsPort. */
export const InjectContentMediaStorage = (): TypedParameterDecorator<SupabaseObjectsPort> =>
    injector<SupabaseObjectsPort>(CONTENT_MEDIA_STORAGE)
