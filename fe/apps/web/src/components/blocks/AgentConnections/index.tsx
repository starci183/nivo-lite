"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { abilityRowsOf, toggleAbility } from "@/components/composites/ProviderRightsCard/rows"
import { useAgentInstallation } from "@/hooks/agentSettings"
import { useAgentNivoTools } from "@/hooks/agentNivoTools"
import { PROVIDER_KINDS, providerLogoOf, providerNameOf, useProviderRights, type HeldProvider } from "@/hooks/providerRights"
import { AUTOMATION_ROUTES, brainTabHref, workspaceHref } from "@/modules/routes"
import { AgentConnectionsBase } from "./component"
import type { AgentConnectionsBaseProps } from "./component"

/** What the route hands the tab: the workspace and the installed agent of the url. */
interface AgentConnectionsProps {
    readonly workspaceId: string
    readonly module: string
    readonly installationId: string
}

/**
 * The Quyền tab of an installed agent (route `/connections`, tab label "Quyền"): a card per provider it holds, with what it may do through
 * each (a write ability also Tự động or Hỏi), grouped Nhắn tin / Thanh toán / Sổ sách; "Gắn thêm provider" attaches another; under
 * them the NIVO tools it may call. The provider rights come from a FAKE source today (`hooks/providerRights/fakeProviderRights.ts`).
 */
export const AgentConnections = (props: AgentConnectionsProps) => {
    const t = useTranslations("agentRights")
    const tabs = useTranslations("modulesCore")
    const agent = useAgentInstallation(props.installationId, props.module).slot
    const view = "items" in agent ? agent.items : undefined
    const agentName = view?.name ?? ""
    const rights = useProviderRights(props.installationId, props.module)
    const tools = useAgentNivoTools(view?.agentId ?? null)
    const [isDrawerOpen, setDrawerOpen] = useState(false)
    const [picked, setPicked] = useState<string | null>(null)
    const [detachKey, setDetachKey] = useState<string | null>(null)
    const connectionsHref = workspaceHref(props.workspaceId, AUTOMATION_ROUTES.connections)
    const detaching = rights.attached.find((one) => one.provider.provider === detachKey)

    const cardOf = (one: HeldProvider): AgentConnectionsBaseProps["props"]["groups"][number]["cards"][number]["card"] => {
        const key = one.provider.provider
        const setAbility = (ability: string, mode: Parameters<typeof rights.setAbility>[2]) =>
            void rights.setAbility(key, ability, mode)
        return {
            props: {
                name: providerNameOf(key),
                logo: providerLogoOf(key),
                line: one.provider.connected
                    ? t("lineConnected", { kind: t(`kind_${one.provider.kind}`) })
                    : t("line", { kind: t(`kind_${one.provider.kind}`) }),
                rows: abilityRowsOf(t, one.provider, one.held, setAbility),
                menu: {
                    label: t("menuLabel"),
                    entries: [{ id: "detach", label: t("detach"), tone: "danger", onAction: () => setDetachKey(key) }],
                },
                connectLink: one.provider.connected ? undefined : { label: t("connectLink"), href: connectionsHref },
            },
            on: { toggle: (id, isOn) => toggleAbility(one.provider, one.held, id, isOn, setAbility) },
        }
    }
    const groups: AgentConnectionsBaseProps["props"]["groups"] = PROVIDER_KINDS.flatMap((kind) => {
        const cards = rights.attached.filter((one) => one.provider.kind === kind)
        return cards.length === 0
            ? []
            : [{ id: kind, label: t(`kind_${kind}`), cards: cards.map((one) => ({ id: one.provider.provider, card: cardOf(one) })) }]
    })
    return (
        <AgentConnectionsBase
            props={{
                paneLabel: tabs("tab_connections"),
                title: t("title"),
                attachLabel: t("attachMore"),
                groups,
                emptyLabel: t("empty", { agent: agentName }),
                tools: {
                    title: t("toolsTitle"),
                    linkLabel: t("toolsLink"),
                    linkHref: workspaceHref(props.workspaceId, brainTabHref("facts")),
                    rows: tools.rows.map((row) => ({ id: row.tool, title: row.name, subtitle: row.description, isOn: row.isOn })),
                    isDisabled: tools.isSaving,
                },
                drawer: {
                    isOpen: isDrawerOpen,
                    title: t("drawerTitle"),
                    closeLabel: t("close"),
                    optionsLabel: t("drawerOptions"),
                    options: rights.attachable.map((option) => ({
                        id: option.provider,
                        title: providerNameOf(option.provider),
                        subtitle: t("line", { kind: t(`kind_${option.kind}`) }),
                    })),
                    pickedId: picked,
                    emptyLabel: t("drawerEmpty"),
                    cancelLabel: t("cancel"),
                    submitLabel: t("attach"),
                },
                detach: {
                    isOpen: detaching !== undefined,
                    title: t("detachTitle", {
                        provider: detaching === undefined ? "" : providerNameOf(detaching.provider.provider),
                        agent: agentName,
                    }),
                    description: t("detachDescription", { agent: agentName }),
                    confirm: t("detach"),
                    cancel: t("cancel"),
                },
            }}
            on={{
                openDrawer: () => {
                    setPicked(null)
                    setDrawerOpen(true)
                },
                closeDrawer: () => setDrawerOpen(false),
                pickAttach: setPicked,
                submitAttach: () => {
                    if (picked !== null) void rights.attach(picked)
                    setDrawerOpen(false)
                },
                cancelDetach: () => setDetachKey(null),
                confirmDetach: () => {
                    if (detachKey !== null) void rights.detach(detachKey)
                    setDetachKey(null)
                },
                toggleTool: tools.set,
            }}
        />
    )
}
