import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { ChainOwnerDirectory } from "./work-chains.port"

/** Token of the owner directory port; the app root binds it to the agents capability. */
export const CHAIN_OWNER_DIRECTORY: unique symbol = Symbol("domain.work-chains.owner-directory")

/** Injects the owner directory. Parameter type: ChainOwnerDirectory. */
export const InjectChainOwnerDirectory = (): TypedParameterDecorator<ChainOwnerDirectory> =>
    injector<ChainOwnerDirectory>(CHAIN_OWNER_DIRECTORY)
