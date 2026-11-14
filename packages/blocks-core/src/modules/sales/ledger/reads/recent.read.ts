import { defineRead, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { recentRowsOf, type RecentRow, type RecentWords } from "../../../../rules/sales/ledger/recent"
import { agentConnectionsPort, coreReadsPort } from "../../../platform/ports"
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
 * `blocks-core.sales.api.entry.recent`: the payments received lately as work the agent did or waits on, each with the connection it came through
 * and the level the agent holds on it (read only, asks first, acts on its own). An installation with no agent names no connection.
 */
export const recentRead: ReadDefinition = defineRead({
    id: "blocks-core.sales.api.entry.recent",
    dataKind: "accounting-recent",
    shape: "list",
    fields: ["id", "time", "title", "connection", "logo", "level", "status"],
    paths: { rows: "list" },
    variables: z.object({ installation: z.uuid() }),
    permission: "sales.view",
    ports: { transactions: TRANSACTIONS, core: coreReadsPort, connections: agentConnectionsPort },
    run: async ({ transactions, core, connections }, given, context): Promise<RecentPage> => {
        const agent = await core.agentOf(given.installation)
        const [payments, region] = await Promise.all([
            recentCredits(transactions, RECENT_SHOWN),
            agent === null ? Promise.resolve(null) : connections.of(agent),
        ])
        const bank = bankConnectionsOf(region?.rows ?? [])
        return { rows: recentRowsOf(payments, bank, wordsOf(context.locale), context.now), cursor: null }
    },
})
