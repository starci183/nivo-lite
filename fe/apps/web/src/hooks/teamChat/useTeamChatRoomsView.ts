"use client"

import { useTranslations } from "next-intl"
import { partyKeyOf } from "@/modules/teamChat"
import { useSlotLabels } from "@/hooks/slot"
import type { ChatParty, SlotLabels, TeamChatRoomsViewProps } from "@/modules/types"
import type { TeamChatListState } from "./useTeamChatListState"

/** The translator of the team chat words. */
type Words = ReturnType<typeof useTranslations<"teamChat">>

/** What the list is made of: its state, the words, and the open room. */
interface RoomsViewContext {
    readonly list: TeamChatListState
    readonly t: Words
    readonly labels: SlotLabels
    readonly selectedId: string | null
}

/** The new-chat drawer: its words and form, with the parties it picks from as options. */
const newChatOf = (context: RoomsViewContext): TeamChatRoomsViewProps["newChat"] => {
    const { list, t } = context
    const { form, people, agents } = list.newChat
    const optionOf = (kind: "kindPerson" | "kindAgent") => (party: ChatParty) => ({
        id: partyKeyOf(party),
        label: party.name,
        description: t(kind),
    })
    return {
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
            empty: t("newChatEmpty"),
        },
        options: [...people.map(optionOf("kindPerson")), ...agents.map(optionOf("kindAgent"))],
        direct: form.direct,
        groupName: form.groupName,
        groupMembers: form.groupMembers,
        isPending: form.isPending,
        error: form.hasFailed ? t("newChatFailed") : null,
    }
}

/** What the list of rooms draws, from its state. */
const roomsViewPropsOf = (context: RoomsViewContext): TeamChatRoomsViewProps => {
    const { t } = context
    return {
        copy: {
            title: t("title"),
            listLabel: t("listLabel"),
            newChat: t("newChat"),
            searchLabel: t("searchLabel"),
            searchPlaceholder: t("searchPlaceholder"),
            searchClear: t("searchClear"),
            searchEmpty: t("searchEmpty"),
            groupLine: t("groupLine"),
            sectionGroup: t("sectionGroup"),
            sectionAgent: t("sectionAgent"),
            sectionPerson: t("sectionPerson"),
            sectionNivo: t("nivoRoom.section"),
            roomsEmpty: t("roomsEmpty"),
            roomsEmptyAction: t("roomsEmptyAction"),
            errorBody: t("errorBody"),
        },
        labels: context.labels,
        slot: context.list.rooms.slot,
        selectedId: context.selectedId,
        query: context.list.query,
        newChat: newChatOf(context),
    }
}

/** What the list of rooms draws, from its state, in the viewer's words. */
export const useTeamChatRoomsView = (list: TeamChatListState, selectedId: string | null): TeamChatRoomsViewProps => {
    const t = useTranslations("teamChat")
    const slotLabels = useSlotLabels()
    return roomsViewPropsOf({
        list,
        t,
        labels: { ...slotLabels(t("roomsEmpty")), error: t("errorTitle") },
        selectedId,
    })
}
