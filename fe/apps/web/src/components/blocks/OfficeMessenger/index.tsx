"use client"

import { useState } from "react"
import { useOfficeFrame, useOfficeJump, useOfficeMessenger } from "@/hooks/officeMessenger"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES, agentChatHref, leadHref } from "@/modules/routes"
import { OfficeMessengerBase } from "./component"

/** The Office: the team messenger. Its data is read in the browser; the draft lives here, the frame and the jumps in their hooks. */
export const OfficeMessenger = () => {
    const router = navigation.useRouter()
    const [draft, setDraft] = useState("")
    const [focusKey, setFocusKey] = useState(0)
    const frame = useOfficeFrame()
    const jump = useOfficeJump()
    const office = useOfficeMessenger(jump.focusedId)
    const { text } = office
    const isLoading = office.slot.isLoading === true

    const onMention = (handle: string) => {
        setDraft((current) => `${current}${current !== "" && !current.endsWith(" ") ? " " : ""}@${handle} `)
        frame.showThread()
        setFocusKey((key) => key + 1)
    }

    const onSend = () => {
        const body = draft.trim()
        if (body === "" || office.sender.isSending) return
        office.sender.dismissFailed()
        setDraft("")
        void office.send(body).then((isSent) => {
            if (!isSent) setDraft((current) => (current === "" ? body : current))
        })
    }

    const onChip = () => {
        const target = office.firstJump
        if (target === null) return
        if (target.kind === "approval") jump.jumpApproval(target.id)
        else jump.jumpException(target.id)
    }

    const subtitle = (): string => {
        if (office.memberCount === 1) return text("memberCountOne")
        if (office.agentCount > 0)
            return text("memberCountAgents", { n: office.memberCount, agents: office.agentCount })
        return text("memberCount", { n: office.memberCount })
    }

    const threadState = (): "loading" | "error" | "ready" => {
        if (office.slot.isError === true) return "error"
        return isLoading ? "loading" : "ready"
    }

    return (
        <OfficeMessengerBase
            props={{
                text,
                phoneView: frame.phoneView,
                centre: frame.centre,
                isLoading,
                isInfoOpen: frame.isInfoOpen,
                isInfoDocked: frame.isInfoDocked,
                subtitle: subtitle(),
                chip: office.firstJump === null ? null : text("needsApprovalChip", { n: office.waitingCount }),
                list: office.panels.list,
                thread: {
                    state: threadState(),
                    items: office.items,
                    outbox: office.sender.outbox,
                    reading: office.reading,
                    typing: office.sender.typing === null ? "" : text("typing", { name: office.sender.typing }),
                    busyId: office.decisions.busyId,
                    hasEarlier: office.thread.hasEarlier,
                    isLoadingEarlier: office.thread.isLoadingEarlier,
                    text,
                },
                composer: {
                    draft,
                    mentions: office.panels.mentions,
                    chatbotHandle: office.chatbotHandle,
                    isSending: office.sender.isSending,
                    isLoading,
                    focusKey,
                    text,
                },
                tasks: office.panels.tasks,
                info: office.panels.info,
            }}
            on={{
                decideApproval: (id, decision, edited) => void office.decisions.decideApproval(id, decision, edited),
                decideWork: (id, choice) => void office.decisions.decideWork(id, choice),
                sendCommand: (id) => void office.decisions.confirmCommand(id),
                cancelCommand: (id) => void office.decisions.cancelCommand(id),
                reply: onMention,
                loadEarlier: office.thread.loadEarlier,
                retry: office.thread.reload,
                change: setDraft,
                send: onSend,
                back: () => (frame.centre === "tasks" ? frame.showChat() : frame.showList()),
                chip: onChip,
                toggleInfo: frame.toggleInfo,
                infoOpenChange: frame.setInfoOpen,
                showChat: frame.showChat,
                openGroup: frame.showThread,
                openAgent: (id) => router.push(agentChatHref(id)),
                openCustomer: (id) => router.push(leadHref(id)),
                jumpApproval: jump.jumpApproval,
                jumpException: jump.jumpException,
                mention: onMention,
                openTasks: frame.showTasks,
                closeInfo: () => frame.setInfoOpen(false),
                openLeads: () => router.push(CONSOLE_ROUTES.leads),
            }}
        />
    )
}
