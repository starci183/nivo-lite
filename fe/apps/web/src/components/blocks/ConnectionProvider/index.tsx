"use client"

import { useTranslations } from "next-intl"
import { useConnectionProvider } from "@/hooks/connectionProvider"
import { useSlotLabels } from "@/hooks/slot"
import { useWorkspaceId } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { AGENTS_ROUTE, CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import { ConnectionProviderBase } from "./component"

/** The provider page the address names: its segment under Connections. */
interface ConnectionProviderProps {
    readonly segment: string
}

/**
 * The connected block of a provider page under Connections: reads the workspace's connections of the provider and the viewer's role,
 * and draws the one Page (band, figures, list, about). The add command goes to the hub, whose wizard drawer the query opens.
 */
export const ConnectionProvider = (props: ConnectionProviderProps) => {
    const t = useTranslations("connections")
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const labels = useSlotLabels()
    const provider = useConnectionProvider(props.segment)
    return (
        <ConnectionProviderBase
            props={{
                copy: {
                    crumbsLabel: t("crumbLabel"),
                    crumbs: [
                        {
                            id: "connections",
                            label: t("title"),
                            href: workspaceHref(workspaceId, CONSOLE_ROUTES.connections),
                        },
                        { id: "provider", label: provider.head.title },
                    ],
                    figuresLabel: t("figuresLabel"),
                    listLabel: t("providerListTitle"),
                    aboutLabel: t("providerAbout", { provider: provider.head.title }),
                    emptyTitle: t("providerEmpty"),
                    emptyHint: t("providerEmptyHint"),
                    errorBody: t("errorBody"),
                    columns: {
                        account: t("providerColAccount"),
                        status: t("providerColStatus"),
                        agents: t("providerColAgents"),
                        action: t("providerColAction"),
                    },
                    open: t("providerOpen"),
                    agentsNone: t("providerAgentsNone"),
                    agentsGrant: t("providerAgentsGrant"),
                    agentsHref: workspaceHref(workspaceId, AGENTS_ROUTE),
                },
                head: provider.head,
                slot: provider.slot,
                labels: labels(t("providerEmpty")),
                isLoading: "isLoading" in provider.slot,
                canAdd: "items" in provider.slot && provider.slot.items.canAdd,
            }}
            on={{ add: () => router.push(provider.head.addHref), retry: provider.retry }}
        />
    )
}
