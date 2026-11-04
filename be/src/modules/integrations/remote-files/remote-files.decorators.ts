import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { RemoteFiles } from "./remote-files.port"

/** Token of the RemoteFiles port. */
export const REMOTE_FILES: unique symbol = Symbol("integrations.remote-files.port")

/** Injects the remote files port. Parameter type: RemoteFiles. */
export const InjectRemoteFiles = (): TypedParameterDecorator<RemoteFiles> => injector<RemoteFiles>(REMOTE_FILES)
