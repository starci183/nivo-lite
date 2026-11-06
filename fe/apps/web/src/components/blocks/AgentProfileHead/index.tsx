"use client"

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { IDENTITY_QUERY } from "@/hooks/installations"
import { usePaneCopy } from "@/hooks/paneFrame"
import { navigation } from "@/modules/i18n"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { ASSIGN_TEXT_MAX, profileChipsOf, useAgentProfile, useAssignComposer } from "@/hooks/agentProfile"
import { useOfficeWords } from "@/hooks/office"
import { useWorkspaceId } from "@/hooks/workspaces"
import { AGENTS_ROUTE, CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
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
    /** The page body the Page draws under the heading. */
    readonly children: ReactNode
}

/** The connected heading of an agent profile: the identity, and the mini composer that hands the agent work. */
export const AgentProfileHead = (props: AgentProfileHeadProps) => {
    const t = useTranslations("agentProfile")
    const words = useOfficeWords()
    const { slot, reload } = useAgentProfile(props.agentId)
    const labels = useSlotLabels()
    const pane = usePaneCopy()
    const pathname = navigation.usePathname()
    const workspaceId = useWorkspaceId()
    const agent = "items" in slot ? slot.items : undefined
    const composer = useAssignComposer(props.agentId, agent?.rules.items ?? [])

    return (
        <AgentProfileHeadBase
            children={props.children}
            props={{
                crumbLabel: t("crumbLabel"),
                assignLabel: t("assignAction"),
                menu: {
                    label: pane.moreActions,
                    identityLabel: t("identityTitle"),
                    identityHref: `${pathname}?${IDENTITY_QUERY}`,
                },
                isLoading: "isLoading" in slot,
                read: mapSlot(slot, () => true),
                labels: labels(t("title")),
                head:
                    agent === undefined
                        ? loadingHeadOf({ t, words, agentId: props.agentId, workspaceId })
                        : profileHeadOf(agent, { t, words, agentId: props.agentId, workspaceId }),
                composer: {
                    isOpen: composer.isOpen,
                    label: t("assignLabel"),
                    placeholder: t("assignPlaceholder"),
                    hint: t("assignHint"),
                    sendLabel: t("assignSend"),
                    closeLabel: t("assignClose"),
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

interface ProfileHeadCopy {
    readonly t: ReturnType<typeof useTranslations<"agentProfile">>
    readonly words: ReturnType<typeof useOfficeWords>
    readonly agentId: string
    readonly workspaceId: string
}
/** The band before the profile is read: the page title and the trail, with the placeholder identity. */
const loadingHeadOf = (copy: ProfileHeadCopy): ProfileHeadView => ({
    ...PLACEHOLDER,
    title: copy.t("title"),
    crumbs: [
        { id: "home", label: copy.t("crumbHome"), href: workspaceHref(copy.workspaceId, CONSOLE_ROUTES.dashboard) },
        { id: "agents", label: copy.t("crumbAgents"), href: workspaceHref(copy.workspaceId, AGENTS_ROUTE) },
        { id: "agent", label: copy.t("title") },
    ],
})

/** Resolves the identity band from the ready profile without coupling the composer state. */
const profileHeadOf = (profile: Parameters<typeof profileChipsOf>[0], copy: ProfileHeadCopy): ProfileHeadView => {
    const name = profile.name
    const handle = profile.handle
    return {
        crumbs: [
            { id: "home", label: copy.t("crumbHome"), href: workspaceHref(copy.workspaceId, CONSOLE_ROUTES.dashboard) },
            { id: "agents", label: copy.t("crumbAgents"), href: workspaceHref(copy.workspaceId, AGENTS_ROUTE) },
            { id: "agent", label: name === "" ? copy.t("title") : name },
        ],
        title: name === "" ? copy.t("title") : name,
        description: `@${handle} · ${copy.words.moduleName(profile.module)}`,
        seed: copy.agentId,
        picture: profile.avatarUrl ?? null,
        chips: profileChipsOf(profile).map((chip) => ({
            id: chip.id,
            label: chip.room === null ? copy.t(`chip_${chip.id}`) : copy.t("chip_room", { room: chip.room }),
            tone: chip.tone,
        })),
        canAssign: profile.isActive,
        composerTitle: copy.t("assignTitle", { name }),
        mention: `@${handle}`,
    }
}
