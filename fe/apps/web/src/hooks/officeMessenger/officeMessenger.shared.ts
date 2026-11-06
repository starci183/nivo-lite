import { slotOfReads } from "@/hooks/slot"
import type {
    OfficeBoard,
    useOfficeBoard,
    useOfficeRooms,
    useOfficeSend,
    useOfficeThread,
    useOfficeWords,
} from "@/hooks/office"
import type { navigation } from "@/modules/i18n"
import { agentChatHref, leadHref, workspaceHref } from "@/modules/routes"
import type { OfficeListView, DataSlot, OfficeText, OfficeThreadProps } from "@/modules/types"
import {
    BASIS_MIN_CHARS,
    EMPTY_OFFICE_CARD_DRAFT,
    NIVO_AVATAR,
    cardCopyOf,
    roomApprovalsOf,
    roomWorksOf,
    threadCopyOf,
} from "@/modules/office"
import type { useOfficeCardDrafts } from "./useOfficeCardDrafts"
import type { OfficeMessengerReading, useOfficeMessenger } from "./useOfficeMessenger"
import type { useOfficePanels } from "./useOfficePanels"
import type { OfficeMessage, OfficeRoom } from "@/modules/office"

/** What the thread draws once its messages are in. */
export type OfficeThreadBody = Omit<OfficeThreadProps["props"], "isLoading">

/** The hint under the basis of an exception: it counts the characters still missing until the basis is long enough. */
const basisHintOf = (hint: string, basisLength: number, text: OfficeText): string =>
    basisLength < BASIS_MIN_CHARS ? `${hint} ${text("basisCount", { n: basisLength, min: BASIS_MIN_CHARS })}` : hint

/** Resolves the loaded thread and sender activity. */
export const officeThreadProps = (
    office: ReturnType<typeof useOfficeMessenger>,
    drafts: ReturnType<typeof useOfficeCardDrafts>,
): OfficeThreadBody => {
    const { text } = office
    return {
        cards: office.items.flatMap((item) => {
            if (item.kind === "day" || item.kind === "message") return []
            const draft = drafts.drafts[item.key] ?? EMPTY_OFFICE_CARD_DRAFT
            const basisLength = draft.basis.trim().replace(/\s+/g, " ").length
            const hint = text("basisHint", { n: BASIS_MIN_CHARS })
            const basisDescription = item.kind === "exception" ? basisHintOf(hint, basisLength, text) : null
            return [
                {
                    item,
                    draft,
                    basisDescription,
                    label: item.kind === "command" ? text("cmdCardLabel", { agent: item.agent }) : item.title,
                },
            ]
        }),
        copy: threadCopyOf(text),
        basisMin: BASIS_MIN_CHARS,
        cardCopy: cardCopyOf(text),
        receipts: office.items.flatMap((item) =>
            item.kind !== "message" || item.status?.kind !== "seen"
                ? []
                : [
                      {
                          key: item.key,
                          overflowLabel: text("readersOverflow", { n: Math.max(0, item.status.readers.length - 3) }),
                          moreLabel:
                              item.status.moreReaders > 0
                                  ? text("readersOverflow", { n: item.status.moreReaders })
                                  : null,
                      },
                  ],
        ),
        copiedKey: drafts.copiedKey,
        items: office.items,
        outbox: office.sender.outbox,
        reading: office.reading,
        typing: typingOf(office),
        busyId: office.decisions.busyId,
        hasEarlier: office.thread.hasEarlier,
        isLoadingEarlier: office.thread.isLoadingEarlier,
    }
}

/** Who types now: the people typing in the room, else the agents the sender called; empty when nobody does. */
const typingOf = (office: ReturnType<typeof useOfficeMessenger>): string => {
    const names = office.peersTyping.length > 0 ? office.peersTyping.join(", ") : office.sender.typing
    return names === null ? "" : office.text("typing", { name: names })
}

/** Resolves the member and agent count beneath the thread title: counts only, so it stays one short line. */
export const officeSubtitle = (office: ReturnType<typeof useOfficeMessenger>): string => {
    const { text } = office
    if (office.roomTitle !== null) {
        const members = text("memberCount", { n: office.memberCount })
        return office.onDutyCount === 0 ? members : `${members} · ${text("roomOnDuty", { n: office.onDutyCount })}`
    }
    if (office.memberCount === 1) return text("memberCountOne")
    if (office.agentCount > 0) return text("memberCountAgents", { n: office.memberCount, agents: office.agentCount })
    return text("memberCount", { n: office.memberCount })
}

/** Binds card decisions and direct conversations to their existing domain owners. */
export const officeMessengerCommands = (
    office: ReturnType<typeof useOfficeMessenger>,
    router: ReturnType<typeof navigation.useRouter>,
    workspaceId: string,
) => ({
    decideCard: (
        kind: "execution" | "work_item",
        id: string,
        decision: "approved" | "rejected",
        edited: string | null,
    ): void => {
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
    },
    openDirect: (kind: "agent" | "lead", id: string): void => {
        void office.markConversationRead(kind, id)
        router.push(workspaceHref(workspaceId, kind === "agent" ? agentChatHref(id) : leadHref(id)))
    },
})

type OfficeReadOwners = {
    readonly board: ReturnType<typeof useOfficeBoard>
    readonly hub: ReturnType<typeof useOfficeRooms>
    readonly thread: ReturnType<typeof useOfficeThread>
    readonly list: ReturnType<typeof useOfficePanels>["list"]
}

type OfficeReadSlotsResult = {
    slot: DataSlot<readonly OfficeMessage[]>
    listSlot: DataSlot<OfficeListView>
    threadSlot: DataSlot<boolean>
    composerSlot: DataSlot<boolean>
    retryList: () => void
    retryThread: () => void
    retryComposer: () => void
}

/** Folds the reads each Office region depends on and retries the same owners. */
export const officeReadSlots = ({ board, hub, thread, list }: OfficeReadOwners): OfficeReadSlotsResult => ({
    slot: thread.slot,
    listSlot: slotOfReads(
        [...hub.listReads, ...board.teamReads, ...board.approvalReads, ...board.workReads],
        () => list,
    ),
    threadSlot: slotOfReads(
        [thread.read, hub.roomRead, hub.markerRead, ...board.teamReads, ...board.approvalReads, ...board.workReads],
        () => true,
    ),
    composerSlot: slotOfReads([...board.composerReads, hub.roomRead], () => true),
    retryList: (): void => {
        board.reload()
        hub.reload()
    },
    retryThread: (): void => {
        board.reload()
        hub.refreshRooms()
        hub.reloadMarkers()
        thread.reload()
    },
    retryComposer: (): void => {
        board.reloadTeam()
        hub.refreshRooms()
    },
})

/** The board scoped to a room: the approvals of its agents and the exceptions of their departments. */
export const scopedBoard = (full: OfficeBoard, current: OfficeRoom | null): OfficeBoard => ({
    ...full,
    pending: roomApprovalsOf(current, full.pending),
    decided: roomApprovalsOf(current, full.decided),
    exceptions: roomWorksOf(current, full.exceptions, full.agents),
    decidedCards: roomWorksOf(current, full.decidedCards, full.agents),
})

/** Resolves the loading command's name and note from its actual target. */
export const readingOf = (
    reading: ReturnType<typeof useOfficeSend>["reading"],
    words: ReturnType<typeof useOfficeWords>,
): OfficeMessengerReading | null => {
    if (reading === null) return null
    const agent = words.moduleName(reading.module)
    return {
        avatar: NIVO_AVATAR,
        ask: words.t("cmdAskReading", { handle: reading.handle }),
        agent,
        label: words.t("cmdCardLabel", { agent }),
        gateNote: words.t("cmdGateNote", { agent }),
    }
}
