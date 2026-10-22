"use client"

import { useTranslations } from "next-intl"
import { useAuthoritySection, visibleGroups } from "@/hooks/authority"
import { useQueryAgentsSwr, useQueryApproverDirectorySwr, useQueryOfficeRoomsSwr } from "@/hooks/swr"
import { mapSlot } from "@/hooks/slot"
import type { StoredRule } from "@/hooks/authority"
import { asksPerson, defaultRule, modeKindOf } from "@/modules/permissions"
import type { Approver, ModeKind } from "@/modules/permissions"
import type { DataSlot } from "@/modules/types"
import { usePermissionWords } from "./usePermissionWords"

/** The tone of the badge a mode wears. */
type ModeTone = "success" | "warning" | "danger"

/** One rule as the table draws it, every word already resolved. */
interface PermissionBoardRow {
    readonly id: string
    readonly title: string
    readonly department: string
    readonly agents: string
    readonly modeLabel: string
    readonly modeTone: ModeTone
    readonly group: ReadonlyArray<string>
    readonly policy: string
    readonly rule: StoredRule
}

const TONES: Readonly<Record<ModeKind, ModeTone>> = {
    auto: "success",
    "auto-up-to": "success",
    "ask-band": "warning",
    ask: "warning",
    never: "danger",
}

/**
 * What the Quyen page needs: the rule of every action the modules can be granted (the stored one, or "ask first" before anybody
 * saved one), worded for the table, and the agents, people and rooms the drawer picks from.
 */
export const usePermissionBoard = () => {
    const g = useTranslations("governance")
    const { slot, reload, rules, isLocked } = useAuthoritySection()
    const agents = useQueryAgentsSwr({})
    const directory = useQueryApproverDirectorySwr()
    const rooms = useQueryOfficeRoomsSwr()

    const agentOptions = (agents.data ?? []).map((agent) => ({ id: agent.id, label: agent.name }))
    const roomOptions = (rooms.data ?? []).flatMap((room) =>
        room.key === null ? [] : [{ id: room.key, label: room.name }],
    )
    const members: ReadonlyArray<Approver> = (directory.data ?? []).map((member) => ({
        id: member.memberId,
        name: member.name,
        role: member.role,
        rooms: member.rooms,
        isActive: member.status === "active",
    }))
    const words = usePermissionWords({ members, rooms: roomOptions, agents: agentOptions })

    const rowOf = (department: string, action: string): PermissionBoardRow => {
        const rule = rules.find((one) => one.department === department && one.action === action)
        const shown = rule ?? defaultRule(department, action)
        return {
            id: `${department}/${action}`,
            title: g(`action_${action}`),
            department: g(`dept_${department}`),
            agents: words.agentWords(shown),
            modeLabel: words.modeWords(shown),
            modeTone: TONES[modeKindOf(shown)],
            group: asksPerson(shown) ? words.groupWords(shown) : [],
            policy: asksPerson(shown) ? words.policyWords(shown) : "",
            rule: shown,
        }
    }
    const rowsOf = (): ReadonlyArray<PermissionBoardRow> =>
        visibleGroups(rules).flatMap((group) => group.actions.map((action) => rowOf(group.department, action)))

    const rowsSlot: DataSlot<ReadonlyArray<PermissionBoardRow>> = mapSlot(slot, rowsOf)
    return { slot: rowsSlot, placeholder: rowsOf(), reload, isLocked, agentOptions, roomOptions, members }
}
