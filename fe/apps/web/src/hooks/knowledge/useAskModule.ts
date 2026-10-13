import { AGENT_MODULES } from "@/modules/documents"
import type { AgentModule } from "@/modules/documents"
import type { ModuleKey } from "@/modules/catalog"
import { useModuleInstallations } from "./useModuleInstallations"

/** The agent the question panel starts on, and whether the installed agents are still loading. */
interface AskModule {
    readonly module: AgentModule
    readonly isLoading: boolean
}

/** The agent the question panel starts on: the one of the address, or the first installed one when the address names none. */
export const useAskModule = (filter: ModuleKey | "all"): AskModule => {
    const { installations, isLoading } = useModuleInstallations()
    const first = (installations ?? [])[0]?.moduleKey
    return {
        module: filter === "all" ? (first ?? AGENT_MODULES[0] ?? "chatbot") : filter,
        isLoading: isLoading || installations === undefined,
    }
}
