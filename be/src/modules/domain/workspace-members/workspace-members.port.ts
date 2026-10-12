import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { AccountDirectory } from "./workspace-members.contracts"

/** Token of the account directory the composition root hands to the workspace capabilities. */
export const ACCOUNT_DIRECTORY: unique symbol = Symbol("domain.workspace-members.account-directory")

/** Injects the account directory. Parameter type: AccountDirectory. */
export const InjectAccountDirectory = (): TypedParameterDecorator<AccountDirectory> =>
    injector<AccountDirectory>(ACCOUNT_DIRECTORY)
