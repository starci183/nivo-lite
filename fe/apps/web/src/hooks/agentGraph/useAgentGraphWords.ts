"use client"

import { useFormatter } from "next-intl"
import type { AgentGraphT } from "@/modules/agent-graph"
import type { AgentGraphWords } from "@/modules/types"

const MILLION = 1_000_000

/** The words a change to the draft needs: the sentence of a condition, the right of a person and the line of a card. */
export const useAgentGraphWords = (t: AgentGraphT): AgentGraphWords => {
    const format = useFormatter()
    const amountOf = (vnd: number): string =>
        vnd % MILLION === 0 ? t("million", { count: vnd / MILLION }) : format.number(vnd)
    return {
        when: (fromVnd, toVnd) => {
            if (fromVnd === null && toVnd === null) return t("whenAny")
            if (fromVnd === null) return t("whenUnder", { to: amountOf(toVnd ?? 0) })
            if (toVnd === null) return t("whenFrom", { from: amountOf(fromVnd) })
            return t("whenBetween", { from: amountOf(fromVnd), to: amountOf(toVnd) })
        },
    }
}
