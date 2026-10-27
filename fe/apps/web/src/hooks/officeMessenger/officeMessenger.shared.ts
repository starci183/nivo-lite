import type { DataSlot, OfficeThreadProps } from "@/modules/types"
import { EMPTY_OFFICE_CARD_DRAFT } from "@/modules/office"
import type { useOfficeCardDrafts } from "./useOfficeCardDrafts"
import type { useOfficeMessenger } from "./useOfficeMessenger"

/** What the thread draws once its messages are in. */
export type OfficeThreadBody = Omit<OfficeThreadProps["props"], "isSkeleton">

/** Carries the status of the room's messages over to what is drawn from them: an empty room is still a ready thread. */
export const roomSlotOf = <T>(slot: DataSlot<unknown>, body: T): DataSlot<T> => ({
    isLoading: slot.isLoading,
    isForbidden: slot.isForbidden,
    isError: slot.isError,
    items: body,
})

/** Resolves the loaded thread and sender activity. */
export const officeThreadProps = (
    office: ReturnType<typeof useOfficeMessenger>,
    drafts: ReturnType<typeof useOfficeCardDrafts>,
): OfficeThreadBody => {
    const { text } = office
    return {
        draftOf: (key) => drafts.drafts[key] ?? EMPTY_OFFICE_CARD_DRAFT,
        copiedKey: drafts.copiedKey,
        items: office.items,
        outbox: office.sender.outbox,
        reading: office.reading,
        typing: typingOf(office),
        busyId: office.decisions.busyId,
        hasEarlier: office.thread.hasEarlier,
        isLoadingEarlier: office.thread.isLoadingEarlier,
        text,
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
