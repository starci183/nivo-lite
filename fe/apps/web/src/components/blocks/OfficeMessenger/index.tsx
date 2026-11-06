"use client"

import { useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import {
    officeSubtitle,
    officeThreadProps,
    officeMessengerCommands,
    useOfficeCardDrafts,
    useOfficeFrame,
    useOfficeJump,
    useOfficeMessenger,
    useOfficeTasksView,
    useOfficeConversationView,
    useOfficeMessengerCopy,
} from "@/hooks/officeMessenger"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { OfficeMessengerBase } from "./component"
import type { OfficeMessengerBaseProps, OfficeMessengerComposer } from "./component"
import { useWorkspaceId } from "@/hooks/workspaces"

/** The Office: the team messenger. Its data is read in the browser; the draft lives here, the frame and the jumps in their hooks. */
export const OfficeMessenger = () => {
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const [draft, setDraft] = useState("")
    const [focusKey, setFocusKey] = useState(0)
    const [room, setRoom] = useState<string | null>(null)
    const frame = useOfficeFrame()
    const jump = useOfficeJump()
    const office = useOfficeMessenger(jump.focusedId, room, frame.isThreadVisible)
    const { text } = office
    const drafts = useOfficeCardDrafts()
    const listMounted =
        (frame.isSideBySide || frame.phoneView === "list") &&
        ("isLoading" in office.listSlot || "items" in office.listSlot)
    const conversationView = useOfficeConversationView(office.panels.list, text, listMounted)
    const taskView = useOfficeTasksView(
        office.panels.tasks,
        text,
        frame.centre === "tasks" && (frame.isSideBySide || frame.phoneView === "thread"),
    )
    const slotLabels = useSlotLabels()
    const commands = composerCommands(draft, setDraft, setFocusKey, office, frame)
    const thread = officeThreadProps(office, drafts)
    const copy = useOfficeMessengerCopy({
        chatbotHandle: office.chatbotHandle,
        fileName: office.sender.fileControl.file?.name ?? null,
        problem: office.sender.fileControl.problem,
        accept: office.sender.fileControl.accept,
    })
    const composer: OfficeMessengerComposer = {
        ...copy.composer,
        mentions: office.panels.mentions,
        isSending: office.sender.isSending,
        draft,
        focusKey,
    }
    return (
        <OfficeMessengerBase
            props={{
                ...copy.chrome,
                phoneView: frame.phoneView,
                centre: frame.centre,
                isInfoOpen: frame.isInfoOpen,
                isCompact: !frame.isSideBySide,
                arrangement: frame.arrangement,
                isMuted: office.isMuted,
                title: office.roomTitle ?? text("title"),
                subtitle: officeSubtitle(office),
                chip: office.firstJump === null ? null : text("needsApprovalChip", { n: office.waitingCount }),
                listSlot: mapSlot(office.listSlot, () => conversationView.view),
                listPlaceholder: conversationView.view,
                threadSlot: mapSlot(office.threadSlot, () => thread),
                threadPlaceholder: thread,
                composerSlot: mapSlot(office.composerSlot, () => composer),
                composerPlaceholder: composer,
                slotLabels: slotLabels(text("emptyMessage")),
                tasks: taskView.view,
                info: office.panels.info,
            }}
            on={messengerActions({
                office,
                frame,
                drafts,
                jump,
                commands,
                router,
                workspaceId,
                conversationView,
                taskView,
                setRoom,
            })}
        />
    )
}

type MessengerActionsContext = {
    readonly office: ReturnType<typeof useOfficeMessenger>
    readonly frame: ReturnType<typeof useOfficeFrame>
    readonly drafts: ReturnType<typeof useOfficeCardDrafts>
    readonly jump: ReturnType<typeof useOfficeJump>
    readonly commands: ReturnType<typeof composerCommands>
    readonly router: ReturnType<typeof navigation.useRouter>
    readonly workspaceId: string
    readonly conversationView: ReturnType<typeof useOfficeConversationView>
    readonly taskView: ReturnType<typeof useOfficeTasksView>
    readonly setRoom: Dispatch<SetStateAction<string | null>>
}

/** Binds the messenger's controls to their existing domain and local owners. */
const messengerActions = (context: MessengerActionsContext): OfficeMessengerBaseProps["on"] => {
    const { office, frame, drafts, jump, commands, router, workspaceId, conversationView, taskView, setRoom } = context
    const { text } = office
    const { onMention, onSend, onChange } = commands
    const { openDirect, decideCard } = officeMessengerCommands(office, router, workspaceId)
    return {
        decideApproval: (id, decision, edited) => void office.decisions.decideApproval(id, decision, edited),
        decideWork: (id, choice) => void office.decisions.decideWork(id, choice),
        decideCard,
        sendCommand: (id) => void office.decisions.confirmCommand(id),
        cancelCommand: (id) => void office.decisions.cancelCommand(id),
        reply: onMention,
        loadEarlier: office.thread.loadEarlier,
        editCard: drafts.editCard,
        copy: drafts.copy,
        retryList: office.retryList,
        retryThread: office.retryThread,
        retryComposer: office.retryComposer,
        change: onChange,
        send: onSend,
        chooseFile: office.sender.fileControl.choose,
        clearFile: office.sender.fileControl.clear,
        back: () => (frame.centre === "tasks" ? frame.showChat() : frame.showList()),
        chip: () => jump.jumpWaiting(office.firstJump),
        toggleInfo: frame.toggleInfo,
        toggleMute: () => void office.setMuted(!office.isMuted),
        infoOpenChange: frame.setInfoOpen,
        showChat: frame.showChat,
        openGroup: roomOpener(setRoom, frame),
        openAgent: (id) => openDirect(id),
        conversationQuery: conversationView.query,
        conversationFilter: conversationView.filter,
        formatMembersOverflow: (n) => text("membersOverflow", { n }),
        jumpApproval: jump.jumpApproval,
        jumpException: jump.jumpException,
        jumpCard: jump.jumpCard,
        mention: onMention,
        openTasks: frame.showTasks,
        closeInfo: () => frame.setInfoOpen(false),
        taskOwner: taskView.onOwner,
        taskStatus: taskView.onStatus,
        clearTasks: taskView.clear,
    }
}

/** Opens a Hub room ("office" is the Office room); its fetched visible thread acknowledges the read. */
const roomOpener =
    (setRoom: Dispatch<SetStateAction<string | null>>, frame: ReturnType<typeof useOfficeFrame>) => (id: string) => {
        const room = id === "office" ? null : id
        setRoom(room)
        frame.showThread()
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
        if ((body === "" && office.sender.fileControl.file === null) || office.sender.isSending) return
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
