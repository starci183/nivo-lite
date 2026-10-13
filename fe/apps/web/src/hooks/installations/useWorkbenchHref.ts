import { isModuleKey } from "@/modules/catalog"
import { agentHref } from "@/modules/installations"

/** The address of the workbench of one agent instance; null when the type of the url is not a module. */
export const useWorkbenchHref = (module: string, installationId: string): string | null =>
    isModuleKey(module) ? agentHref(module, installationId, "workbench") : null
