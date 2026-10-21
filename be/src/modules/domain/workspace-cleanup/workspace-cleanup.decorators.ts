import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { CleanupAccounts, WorkspaceCleanupOptions } from "./workspace-cleanup.options"

/** Token of the workspace-cleanup options, exported so a spec can provide it. */
export const WORKSPACE_CLEANUP_OPTIONS: unique symbol = Symbol("domain.workspace-cleanup.options")

/** Injects the options of the workspace-cleanup capability. Parameter type: WorkspaceCleanupOptions. */
export const InjectWorkspaceCleanupOptions = (): TypedParameterDecorator<WorkspaceCleanupOptions> =>
    injector<WorkspaceCleanupOptions>(WORKSPACE_CLEANUP_OPTIONS)

/** Token of the Auth account administration the composition root hands to the capability. */
export const CLEANUP_ACCOUNTS: unique symbol = Symbol("domain.workspace-cleanup.accounts")

/** Injects the Auth account administration. Parameter type: CleanupAccounts. */
export const InjectCleanupAccounts = (): TypedParameterDecorator<CleanupAccounts> =>
    injector<CleanupAccounts>(CLEANUP_ACCOUNTS)
