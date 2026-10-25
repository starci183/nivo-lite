"use client"

import { useTranslations } from "next-intl"
import { ASSIGN_TEXT_MAX, profileChipsOf, useAgentProfile, useAssignComposer } from "@/hooks/agentProfile"
import { useOfficeWords } from "@/hooks/office"
import { AGENTS_ROUTE, CONSOLE_ROUTES } from "@/modules/routes"
import { AgentProfileHeadBase } from "./component"

/** The agent whose profile heads the page. */
type AgentProfileHeadProps = {
    readonly agentId: string
}

/** The connected heading of an agent profile: the identity, and the mini composer that hands the agent work. */
export const AgentProfileHead = (props: AgentProfileHeadProps) => {
    const t = useTranslations("agentProfile")
    const words = useOfficeWords()
    const { slot } = useAgentProfile(props.agentId)
    const agent = slot.items
    const composer = useAssignComposer(props.agentId, agent?.rules.items ?? [])
    const name = agent?.name ?? ""
    const handle = agent?.handle ?? ""
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
                description: agent === undefined ? "" : `@${handle} · ${words.moduleName(agent.module)}`,
                seed: props.agentId,
                picture: agent?.avatarUrl ?? null,
                chips: (agent === undefined ? [] : profileChipsOf(agent)).map((chip) => ({
                    id: chip.id,
                    label: chip.room === null ? t(`chip_${chip.id}`) : t("chip_room", { room: chip.room }),
                    tone: chip.tone,
                })),
                isLoading: agent === undefined,
                assignLabel: t("assignAction"),
                canAssign: agent?.isActive === true,
                composer: {
                    isOpen: composer.isOpen,
                    title: t("assignTitle", { name }),
                    mention: `@${handle}`,
                    label: t("assignLabel"),
                    placeholder: t("assignPlaceholder"),
                    hint: t("assignHint"),
                    sendLabel: t("assignSend"),
                    text: composer.text,
                    maxLength: ASSIGN_TEXT_MAX,
                    canSend: composer.canSend,
                    isPending: composer.isSending,
                    taskLabel: t("assignTaskLabel"),
                    tasks: composer.actions,
                    task: composer.action,
                    hasTask: composer.hasTask,
                    amountLabel: t("assignAmountLabel"),
                    amount: composer.amount,
                    valueLabel: t("assignValueLabel"),
                    value: composer.amountVnd,
                    leadLabel: t("assignLeadLabel"),
                    leads: composer.customers,
                    lead: composer.leadId,
                },
            }}
            on={{
                toggle: composer.toggle,
                change: composer.setText,
                send: composer.submit,
                task: composer.setAction,
                amount: composer.setAmount,
                value: composer.setAmountVnd,
                lead: composer.setLeadId,
            }}
        />
    )
}
