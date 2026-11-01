import { z } from "zod"
import { MAX_LIMITS, MAX_LIMIT_LENGTH, MAX_TASK_LENGTH } from "./agent-graphs-contract.contracts"

const ID_MAX = 100
const IDS_MAX = 10
const INTENTS_MAX = 60

const limitSchema = z.object({
    text: z.string().trim().min(1).max(MAX_LIMIT_LENGTH),
    triggers: z.array(z.string().min(1).max(ID_MAX)).max(20).default([]),
    trusts: z
        .array(z.enum(["outsider", "member", "manager", "system"]))
        .max(4)
        .default([]),
    fact_ids: z.array(z.string().max(ID_MAX)).max(IDS_MAX).default([]),
})

const contractSchema = z.object({
    intent: z.string().trim().min(1).max(ID_MAX),
    task: z.string().trim().max(MAX_TASK_LENGTH).default(""),
    task_fact_ids: z.array(z.string().max(ID_MAX)).max(IDS_MAX).default([]),
    limits: z.array(limitSchema).max(MAX_LIMITS).default([]),
})

/** What the model answers when NIVO asks it, at setup, for the task and the business limits of each intent: the facts it cites are checked by code. */
export const setupContractsSchema = z.object({ contracts: z.array(contractSchema).max(INTENTS_MAX) })

/** The contracts the model proposed, as the schema parsed them. */
export type SetupProposal = z.infer<typeof setupContractsSchema>
