"use client"

import { useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import {
    officeSubtitle,
    officeThreadProps,
    roomSlotOf,
    useOfficeCardDrafts,
    useOfficeFrame,
    useOfficeJump,
    useOfficeMessenger,
} from "@/hooks/officeMessenger"
import { useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES, agentChatHref, leadHref } from "@/modules/routes"
import { OfficeMessengerBase } from "./component"
import type { OfficeMessengerComposer } from "./component"

/** The Office: the team messenger. Its data is read in the browser; the draft lives here, the frame and the jumps in their hooks. */
export const OfficeMessenger = () => {
    const router = navigation.useRouter()
    const [draft, setDraft] = useState("")
    const [focusKey, setFocusKey] = useState(0)
    const [room, setRoom] = useState<string | null>(null)
    const frame = useOfficeFrame()
    const jump = useOfficeJump()
    const office = useOfficeMessenger(jump.focusedId, room, frame.isThreadVisible)
    const { text } = office
    const drafts = useOfficeCardDrafts()
    const slotLabels = useSlotLabels()
    const { onMention, onSend, onChange } = composerCommands(draft, setDraft, setFocusKey, office, frame)
    const openDirect = directOpener(office, router)
    const onChip = chipOpener(office, jump)
    const thread = officeThreadProps(office, drafts)
    const composer: OfficeMessengerComposer = {
        draft,
        mentions: office.panels.mentions,
        chatbotHandle: office.chatbotHandle,
        isSending: office.sender.isSending,
        focusKey,
        text,
    }
    return (
        <OfficeMessengerBase
            props={{
                text,
                phoneView: frame.phoneView,
                centre: frame.centre,
                isInfoOpen: frame.isInfoOpen,
                isInfoDocked: frame.isInfoDocked,
                isCompact: !frame.isSideBySide,
                arrangement: frame.arrangement,
                isMuted: office.isMuted,
                title: office.roomTitle ?? text("title"),
                subtitle: officeSubtitle(office),
                chip: office.firstJump === null ? null : text("needsApprovalChip", { n: office.waitingCount }),
                listSlot: roomSlotOf(office.slot, office.panels.list),
                listPlaceholder: { ...office.panels.list, conversations: [] },
                threadSlot: roomSlotOf(office.slot, thread),
                threadPlaceholder: { ...thread, items: [], outbox: [], reading: null, typing: "", hasEarlier: false },
                composerSlot: { isLoading: office.slot.isLoading, items: composer },
                composerPlaceholder: composer,
                slotLabels: slotLabels(text("emptyMessage")),
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
                editCard: drafts.editCard,
                copy: drafts.copy,
                retry: office.thread.reload,
                change: onChange,
                send: onSend,
                back: () => (frame.centre === "tasks" ? frame.showChat() : frame.showList()),
                chip: onChip,
                toggleInfo: frame.toggleInfo,
                toggleMute: () => void office.setMuted(!office.isMuted),
                infoOpenChange: frame.setInfoOpen,
                showChat: frame.showChat,
                openGroup: roomOpener(setRoom, frame),
                openAgent: (id) => openDirect("agent", id),
                openCustomer: (id) => openDirect("lead", id),
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

/** Jumps to the oldest thing that waits for a person, which the header chip names. */
const chipOpener = (office: ReturnType<typeof useOfficeMessenger>, jump: ReturnType<typeof useOfficeJump>) => () => {
    const target = office.firstJump
    if (target === null) return
    if (target.kind === "approval") jump.jumpApproval(target.id)
    else jump.jumpException(target.id)
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

/** Opens a Hub room ("office" is the Office room); its fetched visible thread acknowledges the read. */
const roomOpener =
    (setRoom: Dispatch<SetStateAction<string | null>>, frame: ReturnType<typeof useOfficeFrame>) => (id: string) => {
        const room = id === "office" ? null : id
        setRoom(room)
        frame.showThread()
    }

/** Opens an agent's or a customer's direct conversation and marks it read on the way. */
const directOpener =
    (office: ReturnType<typeof useOfficeMessenger>, router: ReturnType<typeof navigation.useRouter>) =>
    (kind: "agent" | "lead", id: string) => {
        void office.markConversationRead(kind, id)
        router.push(kind === "agent" ? agentChatHref(id) : leadHref(id))
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
        office.onDraft("")
        void office.send(body).then((isSent) => {
            if (!isSent) setDraft((current) => (current === "" ? body : current))
        })
    }

    const onChange = (value: string) => {
        setDraft(value)
        office.onDraft(value)
    }

    return { onMention, onSend, onChange }
}
