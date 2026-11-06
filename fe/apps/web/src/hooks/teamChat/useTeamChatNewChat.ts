"use client"

import { useState } from "react"
import { partyOfKey } from "@/modules/teamChat"
import type { ChatParty } from "@/modules/types"
import { useTeamChatPeople } from "./useTeamChatPeople"

/** The form of the new-chat drawer. */
interface NewChatForm {
    readonly isOpen: boolean
    /** The party picked for a direct room, as "kind:id", or null. */
    readonly direct: string | null
    readonly groupName: string
    /** The parties ticked for a group, as "kind:id". */
    readonly groupMembers: ReadonlyArray<string>
    readonly isPending: boolean
    readonly hasFailed: boolean
}

const CLOSED_FORM: NewChatForm = {
    isOpen: false,
    direct: null,
    groupName: "",
    groupMembers: [],
    isPending: false,
    hasFailed: false,
}

/** The room a person asks the form to open. */
interface NewRoomRequest {
    readonly kind: "direct" | "group"
    readonly name?: string
    readonly members: ReadonlyArray<ChatParty>
}

/** The view `useTeamChatNewChat` returns. */
export interface TeamChatNewChatView {
    readonly form: NewChatForm
    readonly people: ReadonlyArray<ChatParty>
    readonly agents: ReadonlyArray<ChatParty>
    readonly open: () => void
    readonly setOpen: (isOpen: boolean) => void
    readonly setDirect: (value: string | null) => void
    readonly setGroupName: (value: string) => void
    readonly setGroupMembers: (value: ReadonlyArray<string>) => void
    readonly startDirect: () => void
    readonly createGroup: () => void
}

/** The new-chat drawer: its form, the people and agents it picks from, and the opening of the room it asks for. */
export const useTeamChatNewChat = (
    openRoom: (request: NewRoomRequest) => Promise<string | null>,
    onOpened: (roomId: string) => void,
): TeamChatNewChatView => {
    const [form, setForm] = useState<NewChatForm>(CLOSED_FORM)
    const { people, agents } = useTeamChatPeople(form.isOpen)
    const everyone = [...people, ...agents]
    const patch = (next: Partial<NewChatForm>): void => setForm((current) => ({ ...current, ...next }))
    const ask = async (request: NewRoomRequest): Promise<void> => {
        patch({ isPending: true, hasFailed: false })
        let opened: string | null = null
        try {
            opened = await openRoom(request)
        } catch {
            opened = null
        }
        if (opened === null) {
            patch({ isPending: false, hasFailed: true })
            return
        }
        setForm(CLOSED_FORM)
        onOpened(opened)
    }
    return {
        form,
        people,
        agents,
        open: () => patch({ isOpen: true }),
        setOpen: (isOpen) => (isOpen ? patch({ isOpen }) : setForm(CLOSED_FORM)),
        setDirect: (direct) => patch({ direct }),
        setGroupName: (groupName) => patch({ groupName }),
        setGroupMembers: (groupMembers) => patch({ groupMembers }),
        startDirect: () => {
            const party = form.direct === null ? undefined : partyOfKey(form.direct, everyone)
            if (party !== undefined) void ask({ kind: "direct", members: [party] })
        },
        createGroup: () => {
            const members = form.groupMembers.flatMap((key) => partyOfKey(key, everyone) ?? [])
            void ask({ kind: "group", name: form.groupName.trim(), members })
        },
    }
}
