"use client"

import { useTranslations } from "next-intl"
import { useModuleGlyph } from "@/hooks/installations"
import { AgentAvatarBase } from "./component"

/** Which module the agent runs and how the mark looks. */
type AgentAvatarProps = {
    readonly module?: string
    readonly size?: "xs" | "sm" | "md" | "lg"
    readonly label?: string
}

/** An AI agent's square mark: the module glyph and a spoken name read from the catalog. */
export const AgentAvatar = (props: AgentAvatarProps) => {
    const t = useTranslations("common")
    const module = props.module ?? "chatbot"
    const glyph = useModuleGlyph(module)
    return (
        <AgentAvatarBase
            props={{
                glyph,
                label: props.label ?? t("agentAvatarLabel", { module }),
                module,
                size: props.size,
            }}
        />
    )
}
