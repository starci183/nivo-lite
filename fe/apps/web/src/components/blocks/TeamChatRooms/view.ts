import type { useTranslations } from "next-intl"
import { partyKeyOf } from "@/hooks/teamChat"
import type { TeamChatListState } from "@/hooks/teamChat"
import type { ChatParty, SlotLabels } from "@/modules/types"
import type { TeamChatRoomsViewProps } from "./types"

/** The translator of the team chat words. */
type Words = ReturnType<typeof useTranslations<"teamChat">>

/** What the list is made of: its state, the words, and the open room. */
export interface RoomsViewContext {
    readonly list: TeamChatListState
    readonly t: Words
    readonly refreshLabel: string
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
export const roomsViewPropsOf = (context: RoomsViewContext): TeamChatRoomsViewProps => {
    const { t } = context
    return {
        copy: {
            title: t("title"),
            listLabel: t("listLabel"),
            newChat: t("newChat"),
            refresh: context.refreshLabel,
            groupLine: t("groupLine"),
            roomsEmpty: t("roomsEmpty"),
            roomsEmptyAction: t("roomsEmptyAction"),
            errorBody: t("errorBody"),
        },
        labels: context.labels,
        slot: context.list.rooms.slot,
        selectedId: context.selectedId,
        newChat: newChatOf(context),
    }
}
