import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { WorkspacesOptions } from "./workspaces.options"

/** Token of the options of the workspaces capability. */
export const WORKSPACES_OPTIONS: unique symbol = Symbol("domain.workspaces.options")

/** Injects the options of the workspaces capability. Parameter type: WorkspacesOptions. */
export const InjectWorkspacesOptions = (): TypedParameterDecorator<WorkspacesOptions> =>
    injector<WorkspacesOptions>(WORKSPACES_OPTIONS)
