import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { WorkspaceLogos } from "./workspace-settings.contracts"

/** Token of the logo store the app root selects. */
export const WORKSPACE_SETTINGS_LOGOS: unique symbol = Symbol("domain.workspace-settings.logos")

/** Injects the logo store. Parameter type: WorkspaceLogos. */
export const InjectWorkspaceLogos = (): TypedParameterDecorator<WorkspaceLogos> =>
    injector<WorkspaceLogos>(WORKSPACE_SETTINGS_LOGOS)
