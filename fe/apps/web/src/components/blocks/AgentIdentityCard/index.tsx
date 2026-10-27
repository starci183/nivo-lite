"use client"

import type { ModuleIconName } from "@/modules/types"
import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    AGENT_NAME_MAX,
    INSTANCE_NAME_MAX,
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
    nameLabel: "-",
    nameHint: "-",
    name: "-",
    maxLength: 1,
    line: "-",
    saveLabel: "-",
    canSave: false,
}

/** The connected name card: one name field for the agent (and its instance), saved on its own. */
export const AgentIdentityCard = (props: AgentIdentityCardProps) => {
    const t = useTranslations("modulesCore")
    const slotLabels = useSlotLabels()
    const { canEdit } = useAgentRights()
    const { slot, reload } = useAgentInstallation(props.installationId, props.module)
    const agent = slot.items
    const isInstance = agent?.isMulti === true
    const saved = (isInstance ? agent?.name : agent?.agentName) ?? ""
    const [draft, setDraft] = useState<string | null>(null)
    const name = draft ?? saved
    const { save, isSaving } = useSaveAgentName(props.installationId, isInstance)
    const minLength = isInstance ? 1 : 2
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
                slot: mapSlot(slot, (installation): IdentityView => ({
                    markLabel: installation.agentName,
                    nameLabel: t(isInstance ? "instanceNameTitle" : "displayName"),
                    nameHint: t(isInstance ? "instanceNameSettingsHint" : "displayNameHint"),
                    name,
                    maxLength: isInstance ? INSTANCE_NAME_MAX : AGENT_NAME_MAX,
                    line: t("agentLine", { handle: installation.agentHandle }),
                    saveLabel: t(isInstance ? "saveInstanceName" : "saveName"),
                    canSave: canEdit && name.trim().length >= minLength && name.trim() !== saved,
                })),
                placeholder: PLACEHOLDER,
                slotLabels: slotLabels(t("agentTitle")),
            }}
            on={{ name: setDraft, save: () => void saveName(), retry: reload }}
        />
    )
}
