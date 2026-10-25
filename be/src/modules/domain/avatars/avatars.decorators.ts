import type { SupabaseObjectsPort } from "@modules/integrations/supabase"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { AvatarAccounts } from "./avatars.contracts"

/** Token of the storage door selected by the app root. */
export const AVATARS_STORAGE: unique symbol = Symbol("domain.avatars.storage")

/** Token of the account door selected by the app root. */
export const AVATARS_ACCOUNTS: unique symbol = Symbol("domain.avatars.accounts")

/** Injects the object storage door. Parameter type: SupabaseObjectsPort. */
export const InjectAvatarsStorage = (): TypedParameterDecorator<SupabaseObjectsPort> =>
    injector<SupabaseObjectsPort>(AVATARS_STORAGE)

/** Injects the account door the person's picture is kept through. Parameter type: AvatarAccounts. */
export const InjectAvatarsAccounts = (): TypedParameterDecorator<AvatarAccounts> =>
    injector<AvatarAccounts>(AVATARS_ACCOUNTS)
