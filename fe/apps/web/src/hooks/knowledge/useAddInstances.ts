import { useLocale } from "next-intl"
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
    const locale = useLocale()
    const member = useWorkspaceMember()
    const { installations } = useModuleInstallations()
    return {
        canWrite: member.canWrite,
        instances: instanceOptions(installations ?? [], locale === "en" ? "en" : "vi"),
    }
}
