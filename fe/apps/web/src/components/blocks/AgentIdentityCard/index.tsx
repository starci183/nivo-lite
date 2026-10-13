"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useSave } from "@/hooks/modules"
import { saveAgentName } from "@/lib/module-actions"
import { AgentIdentityCardBase } from "./component"

/** The agent the card names, as the settings page prepared it. */
type AgentIdentityCardProps = {
    readonly installationId: string
    readonly glyph: string
    readonly module: string
    readonly agentName: string
    readonly handle: string
    /** The instance label of a multi-instance agent: it shares the name with its agent. */
    readonly instanceName: string
    readonly isInstance: boolean
    readonly canEdit: boolean
    readonly isLoading: boolean
}

const AGENT_NAME_MAX = 40
const INSTANCE_NAME_MAX = 80

/** The connected name card: one name field for the agent (and its instance), saved on its own. */
export const AgentIdentityCard = (props: AgentIdentityCardProps) => {
    const t = useTranslations("modulesCore")
    const saved = props.isInstance ? props.instanceName : props.agentName
    const [name, setName] = useState(saved)
    const { note, isPending, save } = useSave()
    const minLength = props.isInstance ? 1 : 2
    return (
        <AgentIdentityCardBase
            props={{
                title: t("agentTitle"),
                glyph: props.glyph,
                module: props.module,
                markLabel: props.agentName,
                nameLabel: t(props.isInstance ? "instanceNameTitle" : "displayName"),
                nameHint: t(props.isInstance ? "instanceNameSettingsHint" : "displayNameHint"),
                name,
                maxLength: props.isInstance ? INSTANCE_NAME_MAX : AGENT_NAME_MAX,
                line: t("agentLine", { handle: props.handle }),
                saveLabel: t(props.isInstance ? "saveInstanceName" : "saveName"),
                canSave: props.canEdit && name.trim().length >= minLength && name.trim() !== saved,
                isDisabled: !props.canEdit || isPending,
                isPending,
                isLoading: props.isLoading,
                noteTitle: t("notSaved"),
                noteTone: note.tone,
                noteText: note.tone === "saved" ? t("saved") : note.text,
            }}
            on={{
                name: setName,
                save: () => save(() => saveAgentName(props.installationId, name, props.isInstance), t("saved")),
            }}
        />
    )
}
