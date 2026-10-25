"use client"

import { useTranslations } from "next-intl"
import { AGENT_NAME_LIMITS, useAgentIdentity } from "@/hooks/agentProfile"
import { AVATAR_ACCEPT } from "@/hooks/avatar"
import { isManager, useMember } from "@/hooks/member"
import { AgentProfileIdentityBase } from "./component"

/** The agent whose identity the card edits. */
type AgentProfileIdentityProps = {
    readonly agentId: string
}

/** The connected identity card: an owner or a manager changes the agent's picture and name; nobody else sees it. */
export const AgentProfileIdentity = (props: AgentProfileIdentityProps) => {
    const t = useTranslations("agentProfile")
    const member = useMember()
    const identity = useAgentIdentity(props.agentId)
    if (!isManager(member)) return null
    const { agent, avatar } = identity
    return (
        <AgentProfileIdentityBase
            props={{
                title: t("identityTitle"),
                seed: props.agentId,
                picture: avatar.preview ?? agent?.avatarUrl ?? null,
                name: identity.name,
                avatar: {
                    label: t("identityAvatarLabel"),
                    prompt: t("identityAvatarPrompt"),
                    hint: t("identityAvatarHint"),
                    accept: AVATAR_ACCEPT,
                    error: avatar.problem === null ? undefined : t(`identityAvatarError_${avatar.problem}`),
                    removeLabel: t("identityAvatarRemove"),
                    canRemove: agent?.avatarUrl !== null && agent?.avatarUrl !== undefined,
                    isBusy: avatar.isBusy,
                },
                nameLabel: t("identityNameLabel"),
                nameHint: t("identityNameHint", { handle: agent?.handle ?? "" }),
                nameError: identity.isNameInvalid ? t("identityNameError", AGENT_NAME_LIMITS) : undefined,
                saveLabel: t("identitySave"),
                failTitle: t("identityFailTitle"),
                isSaving: identity.isSaving,
                isLoading: agent === undefined,
            }}
            on={{
                pick: (files) => void avatar.choose(files),
                remove: () => void avatar.remove(),
                setName: identity.setName,
                save: () => void identity.saveName(),
            }}
        />
    )
}
