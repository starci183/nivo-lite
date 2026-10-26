"use client"

import { useTranslations } from "next-intl"
import { AGENT_NAME_LIMITS, useAgentIdentity } from "@/hooks/agentProfile"
import { useAvatarEditorView } from "@/hooks/avatar"
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
    const { agent, avatar } = identity
    const editor = useAvatarEditorView(avatar, agent?.avatarUrl !== null && agent?.avatarUrl !== undefined)
    if (!isManager(member)) return null
    return (
        <AgentProfileIdentityBase
            props={{
                title: t("identityTitle"),
                seed: props.agentId,
                picture: avatar.preview ?? agent?.avatarUrl ?? null,
                name: identity.name,
                avatar: editor,
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
