"use client"

import { useFormatter } from "next-intl"
import type { AgentGraphT } from "@/modules/agent-graph"
import type { AgentGraphWords } from "@/modules/types"

const MILLION = 1_000_000

/** The words a change to the draft needs: how an amount in dong is written, in the number format of the reader. */
export const useAgentGraphWords = (t: AgentGraphT): AgentGraphWords => {
    const format = useFormatter()
    return {
        amount: (vnd) => (vnd % MILLION === 0 ? t("million", { count: vnd / MILLION }) : format.number(vnd)),
    }
}
