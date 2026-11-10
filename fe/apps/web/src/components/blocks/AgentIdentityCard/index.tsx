"use client"

import type { ModuleIconName } from "@/modules/types"
import { useTranslations } from "next-intl"
import { useAgentInstallation, useAgentPictureEdit, useAgentRights } from "@/hooks/agentSettings"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AgentIdentityCardBase } from "./component"
import type { IdentityView } from "./component"

/** The agent the card dresses: the instance of the url, and the glyph of its type. */
type AgentIdentityCardProps = {
    readonly installationId: string
    readonly module: string
    readonly glyph: ModuleIconName
}

const PLACEHOLDER: IdentityView = {
    markLabel: "-",
    markSeed: "-",
    avatarUrl: null,
}

/**
 * The connected picture card: the picture of the agent (an upload, or a preset: the NIVO AI mark, its role mark, its initials, a shop
 * mark), each change saved at once. The display name is part of the general form beside it.
 */
export const AgentIdentityCard = (props: AgentIdentityCardProps) => {
    const t = useTranslations("modulesCore")
    const tc = useTranslations("agentCreate")
    const tg = useTranslations("agentGeneral")
    const slotLabels = useSlotLabels()
    const { canEdit } = useAgentRights()
    const { slot, reload } = useAgentInstallation(props.installationId, props.module)
    const agent = "items" in slot ? slot.items : undefined
    const hasUpload = agent !== undefined && agent.agentAvatarUrl !== null && agent.agentAvatarPreset === null
    const picture = useAgentPictureEdit(agent?.agentId ?? null, props.module, hasUpload)
    return (
        <AgentIdentityCardBase
            props={{
                title: tg("sublabelPicture"),
                glyph: props.glyph,
                module: props.module,
                isDisabled: !canEdit || picture.isBusy,
                editor: { ...picture.editor, pickLabel: tc("pictureUpload"), removeLabel: tg("useSprout"), isRemoveCompact: true },
                read: {
                    slot: mapSlot(slot, (installation): IdentityView => ({
                        markLabel: installation.name,
                        markSeed: installation.agentId ?? installation.id,
                        avatarUrl: picture.preview ?? installation.agentAvatarUrl,
                    })),
                    placeholder: PLACEHOLDER,
                    labels: slotLabels(t("agentTitle")),
                },
            }}
            on={{
                retry: reload,
                upload: (files) => void picture.upload(files),
                remove: () => void picture.remove(),
            }}
        />
    )
}
