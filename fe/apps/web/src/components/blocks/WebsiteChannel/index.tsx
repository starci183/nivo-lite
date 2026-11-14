"use client"

import { useTranslations } from "next-intl"
import { useSlotLabels } from "@/hooks/slot"
import { useWebsiteChannel } from "@/hooks/websiteChannel"
import { WebsiteChannelBase } from "./component"

/**
 * The website channel on the Connections page: the intake switch, what the site shows, the agent that takes the customers, and the
 * address and embed code of the hosted form. The page is the owner's and the manager's, so anyone else sees nothing of it. It reads and saves through the website intake operations of the back end.
 */
export const WebsiteChannel = () => {
    const t = useTranslations("websiteChannel")
    const slotLabels = useSlotLabels()
    const channel = useWebsiteChannel()
    if (channel.isForbidden) return null
    return (
        <WebsiteChannelBase
            props={{
                words: {
                    title: t("title"),
                    enabledTitle: t("enabledTitle"),
                    enabledBody: t("enabledBody"),
                    chatTitle: t("chatTitle"),
                    chatBody: t("chatBody"),
                    formTitle: t("formTitle"),
                    formBody: t("formBody"),
                    pricesTitle: t("pricesTitle"),
                    pricesBody: t("pricesBody"),
                    agentTitle: t("agentTitle"),
                    agentBody: t("agentBody"),
                    agentLabel: t("agentLabel"),
                    agentDefault: t("agentDefault"),
                    attachTitle: t("attachTitle"),
                    attachHint: t("attachHint"),
                    linkLabel: t("linkLabel"),
                    linkHint: t("linkHint"),
                    embedLabel: t("embedLabel"),
                    embedHint: t("embedHint"),
                    copyLabel: t("copy"),
                    copiedLabel: t("copied"),
                    pendingNote: t("pendingNote"),
                },
                slot: channel.slot,
                placeholder: channel.placeholder,
                slotLabels: slotLabels(t("title")),
                errorBody: t("errorBody"),
                agents: channel.agents,
                isAgentsLoading: channel.isAgentsLoading,
                canEdit: channel.canEdit,
                isBusy: channel.isBusy,
                error: channel.error,
            }}
            on={{ ...channel.on, retry: channel.retry }}
        />
    )
}
