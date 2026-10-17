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
import { AgentIdentityCardBase } from "./component"

/** The agent the card names: the instance of the url, and the glyph of its type. */
type AgentIdentityCardProps = {
    readonly installationId: string
    readonly module: string
    readonly glyph: ModuleIconName
}

/** The connected name card: one name field for the agent (and its instance), saved on its own. */
export const AgentIdentityCard = (props: AgentIdentityCardProps) => {
    const t = useTranslations("modulesCore")
    const { canEdit } = useAgentRights()
    const { slot } = useAgentInstallation(props.installationId, props.module)
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
                markLabel: agent?.agentName ?? "",
                nameLabel: t(isInstance ? "instanceNameTitle" : "displayName"),
                nameHint: t(isInstance ? "instanceNameSettingsHint" : "displayNameHint"),
                name,
                maxLength: isInstance ? INSTANCE_NAME_MAX : AGENT_NAME_MAX,
                line: t("agentLine", { handle: agent?.agentHandle ?? "" }),
                saveLabel: t(isInstance ? "saveInstanceName" : "saveName"),
                canSave: canEdit && name.trim().length >= minLength && name.trim() !== saved,
                isDisabled: !canEdit || isSaving,
                isPending: isSaving,
                isLoading: slot.items === undefined,
            }}
            on={{ name: setDraft, save: () => void saveName() }}
        />
    )
}
