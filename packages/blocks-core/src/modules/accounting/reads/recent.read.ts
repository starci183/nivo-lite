import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { recentRowsOf } from "../../../rules/accounting/recent"
import type { RecentRow, RecentWords } from "../../../rules/accounting/recent"
import { agentConnectionsPort, agentGraphs } from "../../platform/ports"
import { agentOfInstallation } from "../../platform/reads/agent-run-scope"
import { bankConnectionsOf } from "./bank-connections"
import { recentCredits } from "../accounting-today-data"
import { copyOf } from "../messages/copy"
import { TRANSACTIONS } from "../ports"

/** The most items of recent work the read lists. */
export const RECENT_SHOWN = 6

/** The page the list slot reads: the rows, and no further page. */
interface RecentPage {
    /** The recent work, newest first. */
    readonly rows: ReadonlyArray<RecentRow>
    /** There is no next page. */
    readonly cursor: null
}

const wordsOf = (locale: "vi" | "en"): RecentWords => {
    const fill = (key: "recent_matched" | "recent_unmatched" | "recent_other_income") => (amount: string) =>
        copyOf(key, locale).replace("{amount}", amount)
    return {
        matched: fill("recent_matched"),
        unmatched: fill("recent_unmatched"),
        otherIncome: fill("recent_other_income"),
    }
}

/**
 * `accounting.recent`: the payments received lately as work the agent did or waits on, each with the connection it came through
 * and the level the agent holds on it (read only, asks first, acts on its own). An installation with no agent names no connection.
 */
export const recentRead: ReadDefinition = defineRead({
    id: "accounting.recent",
    dataKind: "accounting-recent",
    shape: "list",
    fields: ["id", "time", "title", "connection", "logo", "level", "status"],
    paths: { rows: "list" },
    variables: z.object({ installation: z.uuid() }),
    permission: "accounting.view",
    ports: { transactions: TRANSACTIONS, graphs: agentGraphs, connections: agentConnectionsPort },
    run: async ({ transactions, graphs, connections }, given, context): Promise<RecentPage> => {
        const agent = await agentOfInstallation(graphs, given.installation)
        const [payments, region] = await Promise.all([
            recentCredits(transactions, RECENT_SHOWN),
            agent === null ? Promise.resolve(null) : connections.of(agent),
        ])
        const bank = bankConnectionsOf(region?.rows ?? [])
        return { rows: recentRowsOf(payments, bank, wordsOf(context.locale), context.now), cursor: null }
    },
})
