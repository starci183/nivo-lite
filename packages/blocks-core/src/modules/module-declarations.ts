import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"

/**
 * The declaration of every module whose business runs in this package: its reads, actions, permissions and seed specs. The
 * generic door validates and runs a read or an action by its id from this list, and the one workbench route draws a
 * module's seed spec from it. A module moves here when its hand-written workbench is deleted.
 */
export const MODULE_DECLARATIONS: ReadonlyArray<ModuleDeclaration> = []
