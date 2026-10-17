"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useAgentRights } from "@/hooks/agentSettings"
import { useSetupChat, useSetupState, useSetupVersions, useThreadScroll } from "@/hooks/agentSetup"
import { setupThreadOf } from "@/hooks/agentSetup"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { useSetupWriteWords } from "@/hooks/setupCards"
import { useModuleName } from "@/hooks/installations"
import type { ModuleKey } from "@/hooks/installations"
import { AgentSetupChatBase } from "./component"
import type { AgentSetupChatContent } from "./component"

/** What the Setup page hands the chat: the instance and catalogue key of the url. */
type AgentSetupChatProps = {
    readonly installationId: string
    readonly module: ModuleKey
}

const NO_VERSIONS: ReadonlyArray<never> = []

/** The connected private chat with NIVO: the owner writes, NIVO answers in the background, and the confirm cards sit under its replies. */
export const AgentSetupChat = (props: AgentSetupChatProps) => {
    const t = useTranslations("moduleSetup")
    const typeName = useModuleName(props.module, "shortName")
    const access = useTranslations("access")
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const words = useSetupWriteWords()
    const { canEdit } = useAgentRights()
    const { slot, reload } = useSetupState(props.installationId)
    const versions = useSetupVersions(props.installationId).items?.versions ?? NO_VERSIONS
    const state = slot.items
    const chat = useSetupChat(state?.session.id ?? "", state?.turnPending === true)
    useThreadScroll(`${state?.messages.length ?? 0}:${chat.isSending}:${state?.revisions.length ?? 0}`)
    const groups = setupThreadOf(
        state?.revisions ?? NO_VERSIONS,
        state?.messages ?? NO_VERSIONS,
        state?.writes ?? NO_VERSIONS,
        versions,
        state?.session.id ?? "",
        {
            applied: (version, appliedAt, who) =>
                t("revisionApplied", {
                    version,
                    when: format.dateTime(new Date(appliedAt), { day: "2-digit", month: "2-digit", year: "numeric" }),
                    who,
                }),
            appliedPlain: (version) => t("revisionAppliedPlain", { version }),
        },
    )
    const content: AgentSetupChatContent = {
        chatTitle: t("chatTitle"),
        chatPrivate: t("chatPrivate"),
        emptyTitle: t("emptyTitle"),
        emptyBody: t("emptyBody"),
        groups: groups.map((group) => ({
            id: group.id,
            divider: group.divider,
            messages: group.messages.map(({ message, cards }) => ({
                id: message.id,
                isOwner: message.role === "user",
                author: message.role === "user" ? message.author || t("you") : t("nivo"),
                body: message.body,
                cards,
            })),
        })),
        instance: state?.instance.isMulti === true ? { name: state.instance.name, typeName } : null,
        sendingLabel: t("sending"),
        isSending: chat.isSending,
        composerLabel: t("chatPlaceholder"),
        text: chat.text,
        sendLabel: t("send"),
        words,
        decidingId: chat.decidingId,
    }
    return (
        <AgentSetupChatBase
            props={{
                slot: mapSlot(slot, () => content),
                placeholder: content,
                slotLabels: slotLabels(t("emptyTitle")),
                forbidden: canEdit ? "" : access("forbidden"),
            }}
            on={{
                text: chat.setText,
                send: () => void chat.send(),
                decide: (id, change) => void chat.decide(id, change),
                retry: reload,
            }}
        />
    )
}
