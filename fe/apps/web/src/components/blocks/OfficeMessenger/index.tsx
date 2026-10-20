"use client"

import { useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import { useOfficeFrame, useOfficeJump, useOfficeMessenger } from "@/hooks/officeMessenger"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES, agentChatHref, leadHref } from "@/modules/routes"
import { OfficeMessengerBase } from "./component"

/** The Office: the team messenger. Its data is read in the browser; the draft lives here, the frame and the jumps in their hooks. */
export const OfficeMessenger = () => {
    const router = navigation.useRouter()
    const [draft, setDraft] = useState("")
    const [focusKey, setFocusKey] = useState(0)
    const [room, setRoom] = useState<string | null>(null)
    const frame = useOfficeFrame()
    const jump = useOfficeJump()
    const office = useOfficeMessenger(jump.focusedId, room)
    const { text } = office
    const isLoading = office.slot.isLoading === true

    const { onMention, onSend } = composerCommands(draft, setDraft, setFocusKey, office, frame)

    const onChip = () => {
        const target = office.firstJump
        if (target === null) return
        if (target.kind === "approval") jump.jumpApproval(target.id)
        else jump.jumpException(target.id)
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
                title: office.roomTitle ?? text("title"),
                subtitle: officeSubtitle(office),
                chip: office.firstJump === null ? null : text("needsApprovalChip", { n: office.waitingCount }),
                list: office.panels.list,
                thread: officeThreadProps(office),
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
                decideCard: cardDecider(office),
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
                openGroup: roomOpener(setRoom, frame, office),
                openAgent: (id) => router.push(agentChatHref(id)),
                openCustomer: (id) => router.push(leadHref(id)),
                jumpApproval: jump.jumpApproval,
                jumpException: jump.jumpException,
                jumpCard: jump.jumpCard,
                mention: onMention,
                openTasks: frame.showTasks,
                closeInfo: () => frame.setInfoOpen(false),
                openLeads: () => router.push(CONSOLE_ROUTES.leads),
            }}
        />
    )
}

/** Decides the execution or work item a result card names, through the existing decision mutations. */
const cardDecider =
    (office: ReturnType<typeof useOfficeMessenger>) =>
    (kind: "execution" | "work_item", id: string, decision: "approved" | "rejected", edited: string | null) => {
        if (kind === "execution") void office.decisions.decideApproval(id, decision, edited)
        else
            void office.decisions.decideWork(id, {
                decision,
                draft: edited,
                amountVnd: null,
                fields: [],
                candidateId: null,
                basis: null,
            })
    }

/** Opens a Hub room ("office" is the Office room) and marks it read. */
const roomOpener =
    (
        setRoom: Dispatch<SetStateAction<string | null>>,
        frame: ReturnType<typeof useOfficeFrame>,
        office: ReturnType<typeof useOfficeMessenger>,
    ) =>
    (id: string) => {
        const room = id === "office" ? null : id
        setRoom(room)
        frame.showThread()
        void office.markRead(room)
    }

/** Resolves the loaded thread state and sender activity. */
const officeThreadProps = (office: ReturnType<typeof useOfficeMessenger>) => {
    const { text } = office
    const isLoading = office.slot.isLoading === true
    const threadState = (): "loading" | "error" | "ready" => {
        if (office.slot.isError === true) return "error"
        return isLoading ? "loading" : "ready"
    }
    return {
        state: threadState(),
        items: office.items,
        outbox: office.sender.outbox,
        reading: office.reading,
        typing: office.sender.typing === null ? "" : text("typing", { name: office.sender.typing }),
        busyId: office.decisions.busyId,
        hasEarlier: office.thread.hasEarlier,
        isLoadingEarlier: office.thread.isLoadingEarlier,
        text,
    }
}

/** Owns the composer draft and restores a message when sending fails. */
const composerCommands = (
    draft: string,
    setDraft: Dispatch<SetStateAction<string>>,
    setFocusKey: Dispatch<SetStateAction<number>>,
    office: ReturnType<typeof useOfficeMessenger>,
    frame: ReturnType<typeof useOfficeFrame>,
) => {
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

    return { onMention, onSend }
}

/** Resolves the member and agent count beneath the thread title. */
const officeSubtitle = (office: ReturnType<typeof useOfficeMessenger>): string => {
    const { text } = office
    if (office.roomTitle !== null) {
        const members = text("memberCount", { n: office.memberCount })
        return office.roomOnDuty.length === 0
            ? members
            : `${members} · ${text("roomOnDuty", { names: office.roomOnDuty.join(", ") })}`
    }
    if (office.memberCount === 1) return text("memberCountOne")
    if (office.agentCount > 0) return text("memberCountAgents", { n: office.memberCount, agents: office.agentCount })
    return text("memberCount", { n: office.memberCount })
}
