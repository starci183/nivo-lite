"use client"

import { useTranslations } from "next-intl"
import { isModuleKey, moduleDef } from "@/lib/module-registry"
import { AgentAvatarBase } from "./component"

/** Which module the agent runs and how the mark looks. */
type AgentAvatarProps = {
    readonly module?: string
    readonly size?: "xs" | "sm" | "md" | "lg"
    readonly online?: boolean
    readonly label?: string
}

/** The module's glyph lives in the registry; an unknown key falls back to the chatbot glyph. */
const glyphOf = (module: string): string => (isModuleKey(module) ? moduleDef(module).glyph : moduleDef("chatbot").glyph)

/** An AI agent's square mark: the module glyph and a spoken name read from the catalog. */
export const AgentAvatar = (props: AgentAvatarProps) => {
    const t = useTranslations("common")
    const module = props.module ?? "chatbot"
    return (
        <AgentAvatarBase
            props={{
                glyph: glyphOf(module),
                label: props.label ?? t("agentAvatarLabel", { module }),
                module,
                size: props.size,
                online: props.online,
            }}
        />
    )
}
