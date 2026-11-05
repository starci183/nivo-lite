"use client"

import { useTranslations } from "next-intl"
import { useConnectionsHome } from "@/hooks/connectionsPanes"
import { useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { ConnectionsHomeBase } from "./component"

/** The overview pane of the Connections page: reads the workspace's connections and agents and hands the owner's level picks to the back end. */
export const ConnectionsHome = () => {
    const t = useTranslations("connections")
    const router = navigation.useRouter()
    const labels = useSlotLabels()
    const home = useConnectionsHome()
    return (
        <ConnectionsHomeBase
            props={{
                copy: {
                    grid: t("title"),
                    title: t("overviewTitle"),
                    mainLabel: t("overviewTitle"),
                    figuresLabel: t("overviewTitle"),
                    liveTerm: t("figureLive"),
                    liveMeta: t("figureLiveMeta"),
                    attentionTerm: t("figureAttention"),
                    attentionMeta: t("figureAttentionMeta"),
                    agentsTerm: t("figureAgents"),
                    nextTitle: t("nextTitle"),
                    agentsTitle: t("agentsTitle"),
                    agentsEmpty: t("agentsEmpty"),
                    forbiddenBody: t("forbiddenBody"),
                    emptyBody: t("connectedEmptyHint"),
                    emptyAction: t("openLibrary"),
                    errorBody: t("errorBody"),
                    ownerOnly: t("ownerOnly"),
                },
                slot: home.slot,
                labels: labels(t("connectedEmpty")),
            }}
            on={{
                goTo: (href) => router.push(href),
                openLibrary: () => router.push(`${CONSOLE_ROUTES.connections}?tab=library`),
                retry: home.retry,
            }}
        />
    )
}
