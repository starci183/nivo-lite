import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { AccountDataOptions } from "./account-data.options"

/** Token of the options of the account-data capability. */
export const ACCOUNT_DATA_OPTIONS: unique symbol = Symbol("domain.account-data.options")

/** Injects the options of the account-data capability. Parameter type: AccountDataOptions. */
export const InjectAccountDataOptions = (): TypedParameterDecorator<AccountDataOptions> =>
    injector<AccountDataOptions>(ACCOUNT_DATA_OPTIONS)
