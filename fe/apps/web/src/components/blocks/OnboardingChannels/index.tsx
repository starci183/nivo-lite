"use client"

import { useTranslations } from "next-intl"
import { PROVIDER_LOGO } from "@/hooks/connection-providers"
import { liveConnections, useConnectionsData, wizardQuery } from "@/hooks/connections"
import { useWorkspaceId } from "@/hooks/workspaces"
import { AUTH_ROUTES, workspaceChannelsPath, workspaceHandoverPath } from "@/modules/routes"
import type { Provider } from "@/modules/types"
import { OnboardingChannelsBase } from "./component"

/** The channels the first run offers, in the order of the mockup: where customers write, then where money arrives. */
const CHANNELS = [
    { id: "zalo_oa", name: "channelZalo", description: "channelZaloText" },
    { id: "telegram", name: "channelTelegram", description: "channelTelegramText" },
    { id: "sepay", name: "channelSepay", description: "channelSepayText" },
] as const satisfies ReadonlyArray<{ readonly id: Provider; readonly name: string; readonly description: string }>

/** The connected channels step: reads the workspace connections so a channel already linked shows as connected, and opens the wizard drawer in place. */
export const OnboardingChannels = () => {
    const t = useTranslations("onboarding")
    const workspaceId = useWorkspaceId()
    const { items } = useConnectionsData()
    const live = new Set(liveConnections(items).map((connection) => connection.provider))
    return (
        <OnboardingChannelsBase
            props={{
                title: t("channelsTitle"),
                heading: t("channelsQuestion"),
                description: t("channelsText"),
                channels: CHANNELS.map((channel) => ({
                    id: channel.id,
                    name: t(channel.name),
                    description: t(channel.description),
                    logo: PROVIDER_LOGO[channel.id],
                    connectHref: workspaceChannelsPath(workspaceId, wizardQuery(channel.id)),
                    isConnected: live.has(channel.id),
                })),
                connectLabel: t("connect"),
                connectedLabel: t("connected"),
                backLabel: t("backToLobby"),
                backHref: AUTH_ROUTES.workspaces,
                laterLabel: t("later"),
                continueLabel: t("continue"),
                nextHref: workspaceHandoverPath(workspaceId),
            }}
        />
    )
}
