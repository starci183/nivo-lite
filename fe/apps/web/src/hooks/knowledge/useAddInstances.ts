import { useLocale } from "next-intl"
import { useModuleCatalog } from "@/hooks/moduleCatalog"
import { pickCopy } from "@/modules/catalog"
import { instanceOptions } from "@/modules/documents"
import type { InstanceOption } from "@/modules/documents"
import { useModuleInstallations } from "./useModuleInstallations"
import { useWorkspaceMember } from "./useWorkspaceMember"

/** What the add documents drawer needs to know about the workspace. */
interface AddInstances {
    /** Only owners and managers add documents. */
    readonly canWrite: boolean
    /** The agent instances a document may be kept for. */
    readonly instances: ReadonlyArray<InstanceOption>
}

/** The membership and the agent instances the add documents drawer is built from. */
export const useAddInstances = (): AddInstances => {
    const { modules, slot } = useModuleCatalog()
    const locale = useLocale() === "en" ? "en" : "vi"
    const moduleNames = Object.fromEntries(
        Object.entries(modules).map(([key, module]) => [key, pickCopy(module.name, locale)]),
    )
    const member = useWorkspaceMember()
    const { installations } = useModuleInstallations()
    return {
        canWrite: member.canWrite,
        instances: slot.isLoading === true ? [] : instanceOptions(installations ?? [], moduleNames),
    }
}
