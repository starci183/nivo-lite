import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { logoOf } from "../../../rows/provider-logos"
import { periodOf } from "../../../rules/accounting/period"
import { connectionOf } from "../../../rules/accounting/recent"
import { ownerQueueOf } from "../../../rules/accounting/today"
import type { OwnerQueueWords } from "../../../rules/accounting/today"
import type { DecisionQueueView } from "../../../views/views.types"
import { agentConnectionsPort, agentGraphs } from "../../platform/ports"
import { agentOfInstallation } from "../../platform/reads/agent-run-scope"
import { bankConnectionsOf } from "./bank-connections"
import { openQuestionCount, unmatchedIn, unmatchedPayments, waitingQuestions } from "../accounting-data"
import { copyOf } from "../messages/copy"
import { QUESTIONS, TRANSACTIONS } from "../ports"

const variables: z.ZodObject<{ installation: z.ZodUUID }> = z.object({ installation: z.uuid() })

/** The most payments and the most questions the queue lists. */
export const OWNER_QUEUE_SHOWN = 5

const wordsOf = (locale: "vi" | "en"): OwnerQueueWords => ({
    unmatched: copyOf("queue_unmatched", locale),
    question: copyOf("queue_question", locale),
    inbox: copyOf("queue_in_inbox", locale),
    paymentTitle: (amount) => copyOf("queue_payment_title", locale).replace("{amount}", amount),
})

/**
 * `accounting.owner-queue`: what waits for the owner in one list: the payments of this month nobody tied to an order, then the questions
 * the department asked. Each row is decided through `accounting.decide-owner-item`; the count is every item that waits, not only those listed.
 */
export const ownerQueueRead: ReadDefinition = defineRead({
    id: "accounting.owner-queue",
    dataKind: "accounting-owner-item",
    shape: "record",
    fields: ["count", "more", "rows"],
    paths: { rows: "list" },
    variables,
    permission: "accounting.view",
    ports: { transactions: TRANSACTIONS, questions: QUESTIONS, graphs: agentGraphs, connections: agentConnectionsPort },
    run: async ({ transactions, questions, graphs, connections }, given, context): Promise<DecisionQueueView> => {
        const period = periodOf(context.now, "this")
        const agent = await agentOfInstallation(graphs, given.installation)
        const region = agent === null ? null : await connections.of(agent)
        const bank = connectionOf(null, bankConnectionsOf(region?.rows ?? []))
        const [payments, unmatched, asked, askedTotal] = await Promise.all([
            unmatchedPayments(transactions, period, OWNER_QUEUE_SHOWN),
            unmatchedIn(transactions, period),
            waitingQuestions(questions, OWNER_QUEUE_SHOWN),
            openQuestionCount(questions),
        ])
        return ownerQueueOf(
            payments,
            asked,
            unmatched.count + askedTotal,
            wordsOf(context.locale),
            logoOf(bank?.provider) ?? "",
        )
    },
})
