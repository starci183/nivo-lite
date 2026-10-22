"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { ASSIGN_TEXT_MAX, profileChipsOf, useAgentProfile, useAssignAgentWork } from "@/hooks/agentProfile"
import { moduleGlyphOf } from "@/hooks/installations"
import { AGENTS_ROUTE, CONSOLE_ROUTES } from "@/modules/routes"
import { AgentProfileHeadBase } from "./component"

/** The agent whose profile heads the page. */
type AgentProfileHeadProps = {
    readonly agentId: string
}

/** The connected heading of an agent profile: the identity, and the mini composer that hands the agent work. */
export const AgentProfileHead = (props: AgentProfileHeadProps) => {
    const t = useTranslations("agentProfile")
    const { slot } = useAgentProfile(props.agentId)
    const { send, isSending } = useAssignAgentWork(props.agentId)
    const [isOpen, setIsOpen] = useState(false)
    const [text, setText] = useState("")
    const agent = slot.items
    const name = agent?.name ?? ""
    const submit = async () => {
        if (await send(text.trim())) {
            setText("")
            setIsOpen(false)
        }
    }
    return (
        <AgentProfileHeadBase
            props={{
                crumbLabel: t("crumbLabel"),
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: CONSOLE_ROUTES.dashboard },
                    { id: "agents", label: t("crumbAgents"), href: AGENTS_ROUTE },
                    { id: "agent", label: name === "" ? t("title") : name },
                ],
                eyebrow: t("eyebrow"),
                title: name === "" ? t("title") : name,
                description: agent?.role ?? "",
                glyph: moduleGlyphOf(agent?.module ?? ""),
                module: agent?.module ?? "",
                chips: (agent === undefined ? [] : profileChipsOf(agent)).map((chip) => ({
                    id: chip.id,
                    label: chip.room === null ? t(`chip_${chip.id}`) : t("chip_room", { room: chip.room }),
                    tone: chip.tone,
                })),
                isLoading: agent === undefined,
                assignLabel: t("assignAction"),
                canAssign: agent?.isActive === true,
                composer: {
                    isOpen,
                    title: t("assignTitle", { name }),
                    mention: `@${name}`,
                    label: t("assignLabel"),
                    placeholder: t("assignPlaceholder"),
                    hint: t("assignHint"),
                    sendLabel: t("assignSend"),
                    text,
                    maxLength: ASSIGN_TEXT_MAX,
                    canSend: text.trim().length > 0 && !isSending,
                    isPending: isSending,
                },
            }}
            on={{ toggle: () => setIsOpen((open) => !open), change: setText, send: () => void submit() }}
        />
    )
}
