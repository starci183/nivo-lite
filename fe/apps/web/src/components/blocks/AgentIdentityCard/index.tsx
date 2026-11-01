"use client"

import type { ModuleIconName } from "@/modules/types"
import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    AGENT_NAME_MAX,
    AGENT_NAME_MIN,
    useAgentInstallation,
    useAgentRights,
    useSaveAgentName,
} from "@/hooks/agentSettings"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AgentIdentityCardBase } from "./component"
import type { IdentityView } from "./component"

/** The agent the card names: the instance of the url, and the glyph of its type. */
type AgentIdentityCardProps = {
    readonly installationId: string
    readonly module: string
    readonly glyph: ModuleIconName
}

const PLACEHOLDER: IdentityView = {
    markLabel: "-",
    markSeed: "-",
    avatarUrl: null,
    nameLabel: "-",
    nameHint: "-",
    name: "-",
    maxLength: 1,
    line: "-",
    saveLabel: "-",
    canSave: false,
}

/** The connected name card: the one display name of the agent, the name every screen shows, saved on its own. */
export const AgentIdentityCard = (props: AgentIdentityCardProps) => {
    const t = useTranslations("modulesCore")
    const slotLabels = useSlotLabels()
    const { canEdit } = useAgentRights()
    const { slot, reload } = useAgentInstallation(props.installationId, props.module)
    const agent = slot.items
    const saved = agent?.name ?? ""
    const [draft, setDraft] = useState<string | null>(null)
    const name = draft ?? saved
    const { save, isSaving } = useSaveAgentName(props.installationId)
    const saveName = async () => {
        if (await save(name)) setDraft(null)
    }
    return (
        <AgentIdentityCardBase
            props={{
                title: t("agentTitle"),
                glyph: props.glyph,
                module: props.module,
                isDisabled: !canEdit || isSaving,
                isPending: isSaving,
                read: {
                    slot: mapSlot(slot, (installation): IdentityView => ({
                        markLabel: installation.name,
                        markSeed: installation.agentId ?? installation.id,
                        avatarUrl: installation.agentAvatarUrl,
                        nameLabel: t("displayName"),
                        nameHint: t("displayNameHint"),
                        name,
                        maxLength: AGENT_NAME_MAX,
                        line: t("agentLine", { handle: installation.agentHandle }),
                        saveLabel: t("saveName"),
                        canSave: canEdit && name.trim().length >= AGENT_NAME_MIN && name.trim() !== saved,
                    })),
                    placeholder: PLACEHOLDER,
                    labels: slotLabels(t("agentTitle")),
                },
            }}
            on={{ name: setDraft, save: () => void saveName(), retry: reload }}
        />
    )
}
