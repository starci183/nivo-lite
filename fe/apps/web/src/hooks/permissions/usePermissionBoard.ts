"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useAuthoritySection, visibleGroups } from "@/hooks/authority"
import { useQueryAgentsSwr, useQueryApproverDirectorySwr, useQueryChatRoomsSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import { slotOfReads } from "@/hooks/slot"
import type { StoredRule } from "@/hooks/authority"
import { asksPerson, defaultRule, modeKindOf } from "@/modules/permissions"
import type { Approver, ModeKind } from "@/modules/permissions"
import type { DataSlot } from "@/modules/types"
import { usePermissionWords } from "./usePermissionWords"
import { actionWordOf } from "@/hooks/actionWord"

/** The tone of the badge a mode wears. */
type ModeTone = "success" | "warning" | "danger"

/** One rule as the table draws it, every word already resolved. */
interface PermissionBoardRow {
    readonly id: string
    readonly title: string
    /** One line: the agents it covers (absent when every rule covers every agent), whom it asks and how they decide. */
    readonly description: string
    readonly modeLabel: string
    readonly modeTone: ModeTone
    /** The department that groups the rule in the list, worded. */
    readonly departmentLabel: string
    readonly rule: StoredRule
}

const TONES: Readonly<Record<ModeKind, ModeTone>> = {
    auto: "success",
    "auto-up-to": "success",
    "ask-band": "warning",
    ask: "warning",
    never: "danger",
}

type UsePermissionBoardResult = {
    slot: DataSlot<readonly PermissionBoardRow[]>
    placeholder: readonly PermissionBoardRow[]
    reload: () => void
    isLocked: boolean
    agentOptions: {
        id: string
        label: string
    }[]
    roomOptions: {
        id: string
        label: string
    }[]
    members: readonly Approver[]
}

/** The rooms an approver group may name: the group rooms of the team chat. */
const GROUP_ROOMS = { kind: "group" } as const

/**
 * What the Quyen page needs: the rule of every action the modules can be granted (the stored one, or "ask first" before anybody
 * saved one), worded for the table, and the agents, people and rooms the drawer picks from.
 */
export const usePermissionBoard = (): UsePermissionBoardResult => {
    const g = useTranslations("governance")
    const format = useFormatter()
    const authority = useAuthoritySection()
    const { read, rules, isLocked } = authority
    const agents = useQueryAgentsSwr({})
    const directory = useQueryApproverDirectorySwr()
    const rooms = useQueryChatRoomsSwr(useWorkspaceId(), GROUP_ROOMS)

    const agentOptions = (agents.data ?? []).map((agent) => ({ id: agent.id, label: agent.name }))
    const roomOptions = (rooms.data ?? []).map((room) => ({ id: room.id, label: room.name }))
    const members: ReadonlyArray<Approver> = (directory.data ?? []).map((member) => ({
        id: member.memberId,
        name: member.name,
        role: member.role,
        rooms: member.rooms,
        isActive: member.status === "active",
    }))
    const words = usePermissionWords({ members, rooms: roomOptions, agents: agentOptions })

    const everyAgent = rules.every((rule) => rule.agents.length === 0)
    const rowOf = (department: string, action: string): PermissionBoardRow => {
        const rule = rules.find((one) => one.department === department && one.action === action)
        const shown = rule ?? defaultRule(department, action)
        const asks = asksPerson(shown)
        const line = [
            everyAgent ? "" : words.agentWords(shown),
            asks ? format.list(words.groupWords(shown), { type: "disjunction" }) : "",
            asks ? words.policyWords(shown) : "",
        ]
        return {
            id: `${department}/${action}`,
            title: actionWordOf(g, action),
            description: line.filter((part) => part !== "").join(" · "),
            modeLabel: words.modeWords(shown),
            modeTone: TONES[modeKindOf(shown)],
            departmentLabel: g(`dept_${department}`),
            rule: shown,
        }
    }
    const rowsOf = (): ReadonlyArray<PermissionBoardRow> =>
        visibleGroups(rules).flatMap((group) => group.actions.map((action) => rowOf(group.department, action)))

    const rowsSlot: DataSlot<ReadonlyArray<PermissionBoardRow>> = slotOfReads([read, agents, directory, rooms], () =>
        rowsOf(),
    )
    const reload = (): void => {
        authority.reload()
        void agents.mutate()
        void directory.mutate()
        void rooms.mutate()
    }
    return { slot: rowsSlot, placeholder: rowsOf(), reload, isLocked, agentOptions, roomOptions, members }
}
