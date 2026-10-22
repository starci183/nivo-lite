"use client"

import { useTranslations } from "next-intl"
import type { StoredRule } from "@/hooks/authority"
import { bandsOf, modeKindOf } from "@/modules/permissions"
import type { Approver } from "@/modules/permissions"
import { useBoundFormatter } from "./useBoundFormatter"

/** A choice of a list, already worded. */
interface Choice {
    readonly id: string
    readonly label: string
}

/** The people, rooms and agents a rule can name. */
interface Names {
    readonly members: ReadonlyArray<Approver>
    readonly rooms: ReadonlyArray<Choice>
    readonly agents: ReadonlyArray<Choice>
}

/** How the table words a rule: its mode, the people it asks, the agents it covers and the way they decide. */
export const usePermissionWords = (names: Names) => {
    const t = useTranslations("permissions")
    const g = useTranslations("governance")
    const bound = useBoundFormatter()
    const roleNames: Readonly<Record<string, string>> = {
        owner: t("roleOwner"),
        manager: t("roleManager"),
        staff: t("roleStaff"),
    }
    const policyNames: Readonly<Record<string, string>> = {
        any: t("policyAny"),
        all: t("policyAll"),
        sequential: t("policySequential"),
    }

    const modeWords = (rule: StoredRule): string => {
        const kind = modeKindOf(rule)
        const bands = bandsOf(rule)
        const shown = (value: number | null): string => bound(value ?? 0, rule.unit)
        if (kind === "never") return g("mode_never")
        if (kind === "auto-up-to") return t("modeAutoUpTo", { max: shown(bands.auto) })
        if (kind === "ask-band") {
            return bands.auto === null
                ? t("modeAskUpTo", { max: shown(bands.ask) })
                : t("modeAskBand", { from: shown(bands.auto), to: shown(bands.ask) })
        }
        return kind === "auto" ? g("mode_auto") : g("mode_ask")
    }

    const groupWords = (rule: StoredRule): ReadonlyArray<string> => {
        const roles = rule.roles.map((role) => t("groupRole", { name: roleNames[role] ?? role }))
        const rooms = rule.rooms.map((key) =>
            t("groupRoom", { name: names.rooms.find((room) => room.id === key)?.label ?? key }),
        )
        const people = rule.members.map((id) => `@${names.members.find((member) => member.id === id)?.name ?? id}`)
        return [...roles, ...rooms, ...people]
    }

    const agentWords = (rule: StoredRule): string =>
        rule.agents.length === 0
            ? t("allAgents")
            : rule.agents.map((id) => names.agents.find((agent) => agent.id === id)?.label ?? id).join(", ")

    const policyWords = (rule: StoredRule): string => policyNames[rule.policy] ?? rule.policy

    return { modeWords, groupWords, agentWords, policyWords }
}
