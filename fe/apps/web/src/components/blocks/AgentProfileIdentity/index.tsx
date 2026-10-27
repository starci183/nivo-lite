"use client"

import { useTranslations } from "next-intl"
import { AGENT_NAME_LIMITS, useAgentIdentity } from "@/hooks/agentProfile"
import { useAvatarEditorView } from "@/hooks/avatar"
import { isManager, useMember } from "@/hooks/member"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AgentProfileIdentityBase } from "./component"
import type { ProfileIdentityView } from "./component"

const PLACEHOLDER: ProfileIdentityView = { picture: null, name: "-", nameHint: "-" }

/** The agent whose identity the card edits. */
type AgentProfileIdentityProps = {
    readonly agentId: string
}

/** The connected identity card: an owner or a manager changes the agent's picture and name; nobody else sees it. */
export const AgentProfileIdentity = (props: AgentProfileIdentityProps) => {
    const t = useTranslations("agentProfile")
    const member = useMember()
    const slotLabels = useSlotLabels()
    const identity = useAgentIdentity(props.agentId)
    const { agent, avatar } = identity
    const editor = useAvatarEditorView(avatar, agent?.avatarUrl !== null && agent?.avatarUrl !== undefined)
    if (!isManager(member)) return null
    return (
        <AgentProfileIdentityBase
            props={{
                title: t("identityTitle"),
                seed: props.agentId,
                avatar: editor,
                nameLabel: t("identityNameLabel"),
                nameError: identity.isNameInvalid ? t("identityNameError", AGENT_NAME_LIMITS) : undefined,
                saveLabel: t("identitySave"),
                failTitle: t("identityFailTitle"),
                isSaving: identity.isSaving,
                slot: mapSlot(identity.slot, (profile): ProfileIdentityView => ({
                    picture: avatar.preview ?? profile.avatarUrl ?? null,
                    name: identity.name,
                    nameHint: t("identityNameHint", { handle: profile.handle }),
                })),
                placeholder: PLACEHOLDER,
                slotLabels: slotLabels(t("identityTitle")),
            }}
            on={{
                retry: identity.reload,
                pick: (files) => void avatar.choose(files),
                remove: () => void avatar.remove(),
                setName: identity.setName,
                save: () => void identity.saveName(),
            }}
        />
    )
}
