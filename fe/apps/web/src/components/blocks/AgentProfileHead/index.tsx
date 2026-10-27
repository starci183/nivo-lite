"use client"

import { useTranslations } from "next-intl"
import { ASSIGN_TEXT_MAX, profileChipsOf, useAgentProfile, useAssignComposer } from "@/hooks/agentProfile"
import { useOfficeWords } from "@/hooks/office"
import { AGENTS_ROUTE, CONSOLE_ROUTES } from "@/modules/routes"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AgentProfileHeadBase } from "./component"
import type { ProfileHeadView } from "./component"

const PLACEHOLDER: ProfileHeadView = {
    crumbs: [],
    title: "-",
    description: "-",
    seed: "-",
    picture: null,
    chips: [],
    canAssign: false,
    composerTitle: "-",
    mention: "-",
}

/** The agent whose profile heads the page. */
type AgentProfileHeadProps = {
    readonly agentId: string
}

/** The connected heading of an agent profile: the identity, and the mini composer that hands the agent work. */
export const AgentProfileHead = (props: AgentProfileHeadProps) => {
    const t = useTranslations("agentProfile")
    const words = useOfficeWords()
    const slotLabels = useSlotLabels()
    const { slot, reload } = useAgentProfile(props.agentId)
    const agent = slot.items
    const composer = useAssignComposer(props.agentId, agent?.rules.items ?? [])
    const name = agent?.name ?? ""
    const handle = agent?.handle ?? ""
    return (
        <AgentProfileHeadBase
            props={{
                crumbLabel: t("crumbLabel"),
                eyebrow: t("eyebrow"),
                assignLabel: t("assignAction"),
                slot: mapSlot(slot, (profile): ProfileHeadView => ({
                    crumbs: [
                        { id: "home", label: t("crumbHome"), href: CONSOLE_ROUTES.dashboard },
                        { id: "agents", label: t("crumbAgents"), href: AGENTS_ROUTE },
                        { id: "agent", label: name === "" ? t("title") : name },
                    ],
                    title: name === "" ? t("title") : name,
                    description: `@${handle} · ${words.moduleName(profile.module)}`,
                    seed: props.agentId,
                    picture: profile.avatarUrl ?? null,
                    chips: profileChipsOf(profile).map((chip) => ({
                        id: chip.id,
                        label: chip.room === null ? t(`chip_${chip.id}`) : t("chip_room", { room: chip.room }),
                        tone: chip.tone,
                    })),
                    canAssign: profile.isActive,
                    composerTitle: t("assignTitle", { name }),
                    mention: `@${handle}`,
                })),
                placeholder: PLACEHOLDER,
                slotLabels: slotLabels(t("title")),
                composer: {
                    isOpen: composer.isOpen,
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
                retry: reload,
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
