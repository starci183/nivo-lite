"use client"

import type { useTranslations } from "next-intl"
import {
    QUERY_AGENT_CATALOG_SWR_KEY,
    QUERY_MODULE_INSTALLATIONS_SWR_KEY,
    useMutateCreateAgentInstallationSwr,
} from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import type { CreateProviderRightsInput } from "@/modules/providerRights"
import { storedPresetOf } from "@/modules/agentAvatar"
import { navigation } from "@/modules/i18n"
import { agentHref } from "@/modules/installations"
import { workspaceHref } from "@/modules/routes"
import { useGraphQLWithToast } from "@/modules/toast"
import { matchesSwrKey } from "@/modules/utils"
import { mutate } from "@/modules/viewer-cache"
import type { AgentCreateForm } from "./useAgentCreateForm"
import type { AgentCreatePicture } from "./useAgentCreatePicture"

/** The translator of the dialog copy. */
type CreateCopy = ReturnType<typeof useTranslations<"agentCreate">>

/** What creating the agent hands the dialog. */
interface AgentCreateSubmit {
    readonly isCreating: boolean
    readonly create: () => Promise<void>
    readonly close: () => void
}

/** The shortest name the back end keeps. */
const NAME_MIN = 2

/** Creates the agent from the dialog fields, reads the agents again and opens the new one; closing clears the fields. */
export const useAgentCreateSubmit = (
    form: AgentCreateForm,
    picture: AgentCreatePicture,
    t: CreateCopy,
    providerRights: () => ReadonlyArray<CreateProviderRightsInput>,
): AgentCreateSubmit => {
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const workspaceId = useWorkspaceId()
    const runGraphQL = useGraphQLWithToast()
    const creating = useMutateCreateAgentInstallationSwr()
    const clear = () => {
        form.reset()
        picture.reset()
    }
    const create = async (): Promise<void> => {
        const role = form.role
        const name = form.name.trim()
        if (role === null || name.length < NAME_MIN) return
        const copyFrom = form.start.startsWith("copy:") ? form.start.slice("copy:".length) : null
        const choice = picture.choice
        const created = await runGraphQL(
            () =>
                creating.trigger({
                    moduleKey: role,
                    name,
                    handle: form.typedHandle,
                    avatarPreset: choice.kind === "preset" ? storedPresetOf(choice.preset) : null,
                    avatarPath: choice.kind === "upload" ? choice.path : null,
                    connectionIds: form.canGrantChannels ? [...form.chosenChannels] : [],
                    startFrom: copyFrom === null ? "default" : "copy",
                    copyFrom,
                    providerRights: providerRights().map((one) => ({ provider: one.provider, abilities: [...one.abilities] })),
                }),
            { successMessage: t("created", { name }) },
        )
        if (created === undefined) return
        await Promise.all([
            mutate(matchesSwrKey(QUERY_MODULE_INSTALLATIONS_SWR_KEY)),
            mutate(matchesSwrKey(QUERY_AGENT_CATALOG_SWR_KEY)),
        ])
        clear()
        router.push(workspaceHref(workspaceId, agentHref(role, created.installationId)))
    }
    return {
        isCreating: creating.isMutating,
        create,
        close: () => {
            clear()
            router.replace(pathname)
        },
    }
}
