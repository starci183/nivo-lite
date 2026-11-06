"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { chatGridOf, usePaneCopy, usePanePhone } from "@/hooks/paneFrame"
import { useSlotLabels } from "@/hooks/slot"
import { useTeamChat, useTeamChatPeople } from "@/hooks/teamChat"
import { useWorkspaceId } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { chatRoomHref, workspaceHref } from "@/modules/routes"
import {
    CHAT_FILE_ACCEPT,
    draftWithMention,
    isChatRefusal,
    mentionTriggerOf,
    partyOfKey,
    suggestionsOf,
} from "@/modules/teamChat"
import type { ChatParty } from "@/modules/teamChat"
import { TeamChatBase } from "./component"

/** What the chat is drawn for: the page of every room, or the panel of one agent. */
type TeamChatProps = { readonly kind: "page" } | { readonly kind: "agent"; readonly agentId: string }

/** The decision being settled and why the last answer did not settle one. */
interface DecidingState {
    readonly id: string | null
    readonly error: string | null
}

/** The form of the new-chat drawer. */
interface NewChatForm {
    readonly isOpen: boolean
    readonly direct: string | null
    readonly groupName: string
    readonly groupMembers: ReadonlyArray<string>
    readonly isPending: boolean
    readonly error: string | null
}

const CLOSED_FORM: NewChatForm = {
    isOpen: false,
    direct: null,
    groupName: "",
    groupMembers: [],
    isPending: false,
    error: null,
}

/** The connected team chat: the viewer's rooms, the open thread with its cards, the composer, and the new-chat form. */
export const TeamChat = (props: TeamChatProps) => {
    const t = useTranslations("teamChat")
    const pane = usePaneCopy()
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const slotLabels = useSlotLabels()
    const query = useSearchParams()
    const phone = usePanePhone()
    const requestedRoom = query.get("room")
    const chat = useTeamChat(
        props.kind === "agent"
            ? { kind: "agent", agentId: props.agentId }
            : { kind: "page", ...(requestedRoom === null ? {} : { initialRoomId: requestedRoom }) },
    )
    const [deciding, setDeciding] = useState<DecidingState>({ id: null, error: null })
    const refusalWords = (code: string): string => (isChatRefusal(code) ? t(`refusal_${code}`) : t("sendFailedText"))
    const decide = async (decisionId: string, verdict: "approved" | "refused"): Promise<void> => {
        setDeciding({ id: decisionId, error: null })
        const refusal = await chat.decide(decisionId, verdict)
        setDeciding({ id: null, error: refusal === null ? null : refusalWords(refusal) })
    }
    const [form, setForm] = useState<NewChatForm>(CLOSED_FORM)
    const people = useTeamChatPeople(form.isOpen)
    const everyone: ReadonlyArray<ChatParty> = [...people.people, ...people.agents]
    const trigger = mentionTriggerOf(chat.draft)
    const suggestions = trigger === null ? [] : suggestionsOf(chat.parties, trigger.query)
    const patch = (next: Partial<NewChatForm>): void => setForm((current) => ({ ...current, ...next }))

    const openRoom = async (open: () => Promise<string | null>): Promise<void> => {
        patch({ isPending: true, error: null })
        try {
            const roomId = await open()
            if (roomId === null) {
                patch({ isPending: false, error: t("newChatFailed") })
                return
            }
            setForm(CLOSED_FORM)
            phone.showMain()
        } catch {
            patch({ isPending: false, error: t("newChatFailed") })
        }
    }
    const startDirect = (): void => {
        const party = form.direct === null ? undefined : partyOfKey(form.direct, everyone)
        if (party !== undefined) void openRoom(() => chat.openDirect(party))
    }
    const createGroup = (): void => {
        const members = form.groupMembers.flatMap((key) => {
            const party = partyOfKey(key, everyone)
            return party === undefined ? [] : [party]
        })
        void openRoom(() => chat.openGroup(form.groupName.trim(), members))
    }

    const problem = chat.sendError ?? chat.file.problem
    const composerError = problem === null ? null : { title: t("sendFailedTitle"), text: refusalWords(problem) }
    const agentPanel = props.kind === "agent"
    return (
        <TeamChatBase
            props={{
                copy: {
                    grid: t("gridLabel"),
                    title: t("title"),
                    listLabel: t("listLabel"),
                    threadLabel: t("threadLabel"),
                    newChat: t("newChat"),
                    refresh: pane.refresh,
                    back: pane.backToList,
                    tabAll: t("tabAll"),
                    tabPinned: t("tabPinned"),
                    tabsLabel: t("tabsLabel"),
                    pickTitle: t("pickTitle"),
                    pickBody: t("pickBody"),
                    roomsEmpty: t("roomsEmpty"),
                    roomsEmptyAction: t("roomsEmptyAction"),
                    threadEmpty: agentPanel ? t("agentThreadEmpty") : t("threadEmpty"),
                    errorBody: t("errorBody"),
                    members: t("members"),
                    openFull: t("openFull"),
                    mute: t("mute"),
                    unmute: t("unmute"),
                    groupLine: t("groupLine"),
                },
                labels: { ...slotLabels(t("roomsEmpty")), error: t("errorTitle") },
                roomsSlot: chat.roomsSlot,
                threadSlot: chat.threadSlot,
                isWaiting: chat.isWaiting,
                selectedId: chat.selectedId,
                selectedTitle: chat.selectedTitle,
                selectedOther: chat.selectedOther,
                memberCount: chat.memberCount,
                tab: chat.tab,
                isMuted: chat.selectedId === null ? null : chat.isMuted,
                hasList: !agentPanel,
                grid: chatGridOf({ hasList: !agentPanel, phone: phone.phone }),
                fullHref: agentPanel
                    ? workspaceHref(workspaceId, chat.selectedId === null ? "/chat" : chatRoomHref(chat.selectedId))
                    : null,
                messagesCopy: {
                    pin: t("pin"),
                    unpin: t("unpin"),
                    pinned: t("pinned"),
                    report: t("reportBadge"),
                    approvalPending: t("approvalPending"),
                    approvalApproved: t("approvalApproved"),
                    approvalRefused: t("approvalRefused"),
                    approvalExpired: t("approvalExpired"),
                    approve: t("approve"),
                    refuse: t("refuse"),
                    olderLabel: t("older"),
                    openRun: t("openRun"),
                    decidedBy: t("decidedBy"),
                },
                hasOlder: chat.hasOlder,
                isLoadingOlder: chat.isLoadingOlder,
                decidingId: deciding.id,
                decideError: deciding.error,
                composer: {
                    formLabel: t("composerLabel"),
                    messageLabel: t("messageLabel"),
                    placeholder: agentPanel ? t("agentPlaceholder") : t("placeholder"),
                    sendLabel: t("send"),
                    draft: chat.draft,
                    typing: chat.typing.length === 0 ? null : `${chat.typing.join(", ")} ${t("typingSuffix")}`,
                    file: {
                        label: t("attach"),
                        removeLabel: t("removeFile"),
                        accept: CHAT_FILE_ACCEPT,
                        name: chat.file.file === null ? null : chat.file.file.name,
                        canPick: chat.selectedId !== null,
                    },
                    isSending: chat.isSending || chat.file.isUploading,
                    isLoading: chat.isWaiting,
                    canSend: !chat.isSending && !chat.file.isUploading && (chat.selectedId !== null || agentPanel),
                    error: composerError,
                    suggestions,
                },
                newChat: agentPanel
                    ? null
                    : {
                          isOpen: form.isOpen,
                          copy: {
                              title: t("newChatTitle"),
                              description: t("newChatBody"),
                              closeLabel: t("newChatClose"),
                              directTitle: t("directTitle"),
                              directLabel: t("directLabel"),
                              directPlaceholder: t("directPlaceholder"),
                              directStart: t("directStart"),
                              groupTitle: t("groupTitle"),
                              groupNameLabel: t("groupNameLabel"),
                              groupMembersLabel: t("groupMembersLabel"),
                              groupCreate: t("groupCreate"),
                              kindPerson: t("kindPerson"),
                              kindAgent: t("kindAgent"),
                              empty: t("newChatEmpty"),
                          },
                          people: people.people,
                          agents: people.agents,
                          direct: form.direct,
                          groupName: form.groupName,
                          groupMembers: form.groupMembers,
                          isPending: form.isPending,
                          error: form.error,
                      },
            }}
            on={{
                refresh: chat.refreshAll,
                select: (roomId) => {
                    chat.select(roomId)
                    phone.showMain()
                },
                back: phone.showList,
                tab: chat.setTab,
                older: () => void chat.loadOlder(),
                pin: (messageId, pinned) => void chat.togglePin(messageId, pinned),
                decide: (decisionId, verdict) => void decide(decisionId, verdict),
                draft: chat.setDraft,
                mention: (party) => {
                    if (trigger !== null) chat.setDraft(draftWithMention(chat.draft, trigger, party))
                },
                send: () => void chat.send(),
                file: chat.file.choose,
                fileClear: chat.file.clear,
                toggleMute: () => void chat.toggleMute(),
                openNewChat: () => patch({ isOpen: true }),
                openFull: () =>
                    router.push(
                        workspaceHref(workspaceId, chat.selectedId === null ? "/chat" : chatRoomHref(chat.selectedId)),
                    ),
                newChatOpenChange: (isOpen) => (isOpen ? patch({ isOpen }) : setForm(CLOSED_FORM)),
                newChatDirect: (value) => patch({ direct: value }),
                newChatGroupName: (value) => patch({ groupName: value }),
                newChatGroupMembers: (value) => patch({ groupMembers: value }),
                newChatStartDirect: startDirect,
                newChatCreateGroup: createGroup,
            }}
        />
    )
}

