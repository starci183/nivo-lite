"use client"

import { notFound } from "next/navigation"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { IDENTITY_QUERY } from "@/hooks/installations"
import { usePaneCopy } from "@/hooks/paneFrame"
import { navigation } from "@/modules/i18n"
import { profileChipsOf, useAgentPages, useAgentProfile, useProfileModuleName } from "@/hooks/agentProfile"
import { useWorkspaceId } from "@/hooks/workspaces"
import { AGENTS_ROUTE, CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import { AgentProfileHeadBase, type ProfileHeadView } from "./component"

const PLACEHOLDER: ProfileHeadView = {
    crumbs: [],
    title: "-",
    description: "-",
    seed: "-",
    picture: null,
    chips: [],
}

/** The agent whose profile heads the page. */
type AgentProfileHeadProps = {
    readonly agentId: string
    /** The page body the Page draws under the heading. */
    readonly children: ReactNode
}

/** The connected heading of an agent profile: the identity and the identity menu. An id that is no agent of the workspace is `notFound()`. */
export const AgentProfileHead = (props: AgentProfileHeadProps) => {
    const t = useTranslations("agentProfile")
    const { slot, isMissing } = useAgentProfile(props.agentId)
    const pane = usePaneCopy()
    const pathname = navigation.usePathname()
    const workspaceId = useWorkspaceId()
    const agent = "items" in slot ? slot.items : undefined
    const moduleName = useProfileModuleName(agent?.module)
    const pages = useAgentPages(props.agentId)
    if (isMissing) notFound()

    return (
        <AgentProfileHeadBase
            props={{
                crumbLabel: t("crumbLabel"),
                menu: {
                    label: pane.moreActions,
                    identityLabel: t("identityTitle"),
                    identityHref: `${pathname}?${IDENTITY_QUERY}`,
                },
                open: pages === null ? null : { label: t("openAgent"), href: pages.home },
                isLoading: "isLoading" in slot,
                head:
                    agent === undefined
                        ? loadingHeadOf({ t, moduleName, agentId: props.agentId, workspaceId })
                        : profileHeadOf(agent, { t, moduleName, agentId: props.agentId, workspaceId }),
            }}
        >
            {props.children}
        </AgentProfileHeadBase>
    )
}

interface ProfileHeadCopy {
    readonly t: ReturnType<typeof useTranslations<"agentProfile">>
    readonly moduleName: string
    readonly agentId: string
    readonly workspaceId: string
}
/** The band before the profile is read: the page title and the trail, with the placeholder identity. */
const loadingHeadOf = (copy: ProfileHeadCopy): ProfileHeadView => ({
    ...PLACEHOLDER,
    title: copy.t("title"),
    crumbs: [
        { id: "home", label: copy.t("crumbHome"), href: workspaceHref(copy.workspaceId, CONSOLE_ROUTES.workspaceHome) },
        { id: "agents", label: copy.t("crumbAgents"), href: workspaceHref(copy.workspaceId, AGENTS_ROUTE) },
        { id: "agent", label: copy.t("title") },
    ],
})

/** Resolves the identity band from the ready profile. */
const profileHeadOf = (profile: Parameters<typeof profileChipsOf>[0], copy: ProfileHeadCopy): ProfileHeadView => {
    const name = profile.name
    const handle = profile.handle
    return {
        crumbs: [
            {
                id: "home",
                label: copy.t("crumbHome"),
                href: workspaceHref(copy.workspaceId, CONSOLE_ROUTES.workspaceHome),
            },
            { id: "agents", label: copy.t("crumbAgents"), href: workspaceHref(copy.workspaceId, AGENTS_ROUTE) },
            { id: "agent", label: name === "" ? copy.t("title") : name },
        ],
        title: name === "" ? copy.t("title") : name,
        description: `@${handle} · ${copy.moduleName}`,
        seed: copy.agentId,
        picture: profile.avatarUrl ?? null,
        chips: profileChipsOf(profile).map((chip) => ({
            id: chip.id,
            label: chip.room === null ? copy.t(`chip_${chip.id}`) : copy.t("chip_room", { room: chip.room }),
            tone: chip.tone,
        })),
    }
}
