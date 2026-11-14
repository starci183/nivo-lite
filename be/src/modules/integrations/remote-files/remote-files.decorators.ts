import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { RemoteFilesOptions } from "./remote-files.options"
import type { RemoteFiles } from "./remote-files.port"

/** Token of the remote file limits. */
export const REMOTE_FILES_OPTIONS: unique symbol = Symbol("integrations.remote-files.options")

/** Token of the RemoteFiles port. */
export const REMOTE_FILES: unique symbol = Symbol("integrations.remote-files.port")

/** Injects the remote file limits. Parameter type: RemoteFilesOptions. */
export const InjectRemoteFilesOptions = (): TypedParameterDecorator<RemoteFilesOptions> =>
    injector<RemoteFilesOptions>(REMOTE_FILES_OPTIONS)

/** Injects the remote files port. Parameter type: RemoteFiles. */
export const InjectRemoteFiles = (): TypedParameterDecorator<RemoteFiles> => injector<RemoteFiles>(REMOTE_FILES)
