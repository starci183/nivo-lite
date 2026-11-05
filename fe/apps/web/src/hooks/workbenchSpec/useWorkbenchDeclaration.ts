import { useMemo } from "react"
import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { declarationOf } from "@/modules/workbench-spec"

/** The declaration of the module a workbench route names: the reads, actions and permissions its spec binds; null when none is declared. */
export const useWorkbenchDeclaration = (module: string): ModuleDeclaration | null =>
    useMemo(() => declarationOf(module), [module])
