"use client"

import { useTranslations } from "next-intl"
import { useCallback, useMemo, useState } from "react"
import { mutate } from "swr"
import { useAvatarUpload } from "@/hooks/avatar"
import type { AvatarDoors } from "@/hooks/avatar"
import {
    QUERY_MODULE_INSTALLATIONS_SWR_KEY,
    useMutateRenameAgentSwr,
    useMutateRequestAgentAvatarUploadSwr,
    useMutateSetAgentAvatarSwr,
} from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { matchesSwrKey } from "@/modules/utils"
import { AGENT_NAME_LIMITS } from "./agentProfile.shared"
import { useAgentProfile } from "./useAgentProfile"

/**
 * The display identity of an agent a manager edits on its profile, like a person's: the name (free text, the @handle stays) and
 * the picture. Each save is toasted, then the profile and the Office board read the agent again.
 */
export const useAgentIdentity = (agentId: string) => {
    const t = useTranslations("agentProfile")
    const runGraphQL = useGraphQLWithToast()
    const { slot, reload } = useAgentProfile(agentId)
    const rename = useMutateRenameAgentSwr()
    const requestUpload = useMutateRequestAgentAvatarUploadSwr()
    const setAvatar = useMutateSetAgentAvatarSwr()
    const [draft, setDraft] = useState<string | null>(null)
    const [isNameInvalid, setNameInvalid] = useState(false)
    const agent = slot.items
    const name = draft ?? agent?.name ?? ""

    const refresh = useCallback(async () => {
        reload()
        await mutate(matchesSwrKey(QUERY_MODULE_INSTALLATIONS_SWR_KEY))
    }, [reload])

    const doors = useMemo<AvatarDoors>(
        () => ({
            request: (file) => requestUpload.trigger(file),
            set: (path) => setAvatar.trigger({ agentId, path }),
            refresh,
            savedMessage: t("identityAvatarSaved"),
            removedMessage: t("identityAvatarRemoved"),
        }),
        [agentId, requestUpload, setAvatar, refresh, t],
    )
    const avatar = useAvatarUpload(doors)

    const saveName = useCallback(async () => {
        const clean = name.trim()
        const isValid = clean.length >= AGENT_NAME_LIMITS.min && clean.length <= AGENT_NAME_LIMITS.max
        setNameInvalid(!isValid)
        if (!isValid) return
        const saved = await runGraphQL(() => rename.trigger({ agentId, name: clean }), {
            successMessage: t("identityNameSaved"),
        })
        if (saved === undefined) return
        setDraft(null)
        await refresh()
    }, [agentId, name, rename, runGraphQL, refresh, t])

    return {
        agent,
        slot,
        reload,
        name,
        setName: setDraft,
        isNameInvalid,
        saveName,
        isSaving: rename.isMutating,
        avatar,
    }
}
