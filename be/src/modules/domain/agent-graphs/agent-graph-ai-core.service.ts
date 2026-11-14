import { Injectable, Optional } from "@nestjs/common"
import { z } from "zod"
import type { StepJson } from "@modules/domain/agent-runs"
import { ChannelDeliveriesService } from "@modules/domain/customer-routes"
import { isRecord } from "@modules/platform/primitives"
import { GraphNodeHostService, GraphNodeRegistryService, type NodeTurn } from "@modules/domain/graph-nodes"
import {
    AI_CORE_FAILED,
    AI_CORE_OUTPUT_INVALID,
    boundedJson,
    coreDecisionSchema,
    coreInstructionsOf,
    coreReportSchema,
    type CoreSuggestion,
    type StepTrouble,
} from "./policies/step-trouble.policy"

/** What the AI core's call is metered as. */
const PURPOSE = "engine:step-trouble"

/** The most lines of the conversation the AI core reads, the newest ones. */
const TRANSCRIPT_LINES = 20

/** A step that could not complete, with everything the AI core decides from. */
export interface CoreAsk {
    /** The turn the step ran in. */
    readonly turn: NodeTurn
    /** The key of the node in the graph. */
    readonly nodeKey: string
    /**
     * The run step that could not complete (the node key, or `<node>[<index>]` in a for-each body): the AI core's call is booked to it,
     * so the run page lists it under that step and never as a call of no step. Absent books the node key.
     */
    readonly stepKey?: string | undefined
    /** The installed node the step runs. */
    readonly nodeStep: string
    /** What went wrong, as true facts. */
    readonly trouble: StepTrouble
    /** What the node was given (its settings and data), or null when even that could not be bound. */
    readonly given: Readonly<Record<string, unknown>> | null
    /** What woke the run. */
    readonly trigger: StepJson
    /** The results of the steps done before, by step key. */
    readonly earlier: Readonly<Record<string, StepJson>>
    /** The customer's memory across workflows, or null. */
    readonly memory: unknown
    /** The customer's conversation, or null when the run serves none. */
    readonly conversationId: string | null
}

/**
 * What the AI core decided: the step's output (the chain goes on), its report (the team is told in its words, the workflow waits), or
 * nothing because the AI itself failed (the one case the engine speaks for itself).
 */
export type CoreDecision =
    | { readonly kind: "output"; readonly output: unknown }
    | {
          readonly kind: "report"
          readonly reason: string
          readonly question: string | null
          readonly suggestions: ReadonlyArray<CoreSuggestion>
          readonly customerLine: string | null
      }
    | { readonly kind: "ai_failed"; readonly code: string }

@Injectable()
/**
 * The AI core of the node graphs: the one decision on a step that could not complete, whatever the reason (the node threw, an
 * executor refused, a business failure had no route, the node's own AI was confused). No code of the engine or of a graph enumerates
 * those cases: the AI reads the step's contract, what the step was given, the customer's memory and conversation, and the true facts
 * of what went wrong, and decides once: the step's output, checked against the node's own output schema, or its report to the founder
 * and what, if anything, to tell the customer. A step that runs effects is never answered for: its effect is the truth, and only its
 * executor performs it under its own guard, so a guard can never be passed by an AI's answer. An AI that cannot be reached, or whose
 * answer breaks the contract, is answered as `ai_failed`, never as a guess.
 */
export class AgentGraphAiCoreService {
    constructor(
        private readonly host: GraphNodeHostService,
        private readonly nodes: GraphNodeRegistryService,
        @Optional() private readonly deliveries?: ChannelDeliveriesService,
    ) {}

    /** Decides one step that could not complete. Exactly one call of the model; never throws. */
    async decide(asked: CoreAsk): Promise<CoreDecision> {
        const definition = this.nodes.installed().nodes.get(asked.nodeStep)
        const mayProduce = definition?.effects.length === 0
        try {
            const answer = await this.host.core(
                asked.turn,
                {
                    purpose: PURPOSE,
                    instructions: coreInstructionsOf(asked.turn.locale, mayProduce),
                    input: await this.readingOf(asked, definition?.output),
                },
                mayProduce ? coreDecisionSchema : coreReportSchema,
                asked.stepKey ?? asked.nodeKey,
            )
            if (answer.decision === "report") {
                const line = answer.customerLine?.trim() ?? ""
                const question = answer.question?.trim() ?? ""
                return {
                    kind: "report",
                    reason: answer.reason.trim(),
                    question: question === "" ? null : question,
                    suggestions: answer.suggestions.map((one) => ({ text: one.text.trim(), handledBy: one.handledBy })),
                    customerLine: line === "" ? null : line,
                }
            }
            const output = definition?.output.safeParse(answer.output)
            return output?.success === true
                ? { kind: "output", output: output.data }
                : { kind: "ai_failed", code: AI_CORE_OUTPUT_INVALID }
        } catch {
            return { kind: "ai_failed", code: AI_CORE_FAILED }
        }
    }

    /** What the AI core reads: the contract, what the step was given, the context of the customer, and what went wrong. */
    private async readingOf(asked: CoreAsk, output: z.ZodType | undefined): Promise<Readonly<Record<string, unknown>>> {
        return {
            step: {
                key: asked.nodeKey,
                node: asked.nodeStep,
                outputSchema: output === undefined ? null : jsonSchemaOf(output),
            },
            given: boundedJson(asked.given),
            trigger: boundedJson(asked.trigger),
            earlierSteps: boundedJson(asked.earlier),
            customerMemory: boundedJson(asked.memory),
            conversation: await this.transcriptOf(asked),
            whatWentWrong: {
                kind: asked.trouble.kind,
                code: asked.trouble.code,
                text: asked.trouble.text,
                data: boundedJson(asked.trouble.data),
            },
        }
    }

    /**
     * The newest lines of the customer's thread, oldest first, from the engine's own state: the customer's words of the wake that started
     * the run (`trigger.messages`, read from the raw message rows) and what the shop told the customer on the route (the delivery ledger:
     * delivered rows, whoever told them). It reads no chatbot record, so the customer's EARLIER lines (before this wake), the lines of a
     * message that was not delivered and the system notices are not in it; a graph that wants more hands it to the step. Null when the run
     * serves no route or the ledger cannot be read.
     */
    private async transcriptOf(asked: CoreAsk): Promise<ReadonlyArray<{ role: string; body: string }> | null> {
        if (asked.conversationId === null) return null
        try {
            const told =
                this.deliveries === undefined
                    ? []
                    : (await this.deliveries.listByRoute(asked.turn.workspaceId, asked.conversationId, { limit: TRANSCRIPT_LINES })).rows
            const said = [
                ...wakeLinesOf(asked.trigger),
                ...told.flatMap((row) =>
                    row.state === "delivered" ? [{ role: "agent", body: row.text, at: row.deliveredAt ?? row.createdAt }] : [],
                ),
            ]
            return said
                .toSorted((left, right) => left.at.localeCompare(right.at))
                .slice(-TRANSCRIPT_LINES)
                .map(({ role, body }) => ({ role, body }))
        } catch {
            return null
        }
    }
}

/** The customer's lines of the wake, from the trigger's `messages` (each with its words and time); anything that is not such a line is left out. */
const wakeLinesOf = (trigger: StepJson): ReadonlyArray<{ role: string; body: string; at: string }> => {
    const messages: unknown = Reflect.get(trigger, "messages")
    return (Array.isArray(messages) ? messages : []).flatMap((entry: unknown) =>
        isRecord(entry) && typeof entry.text === "string" && entry.text !== ""
            ? [{ role: "user", body: entry.text, at: typeof entry.at === "string" ? entry.at : "" }]
            : [],
    )
}

/** The JSON Schema of a node's output for the AI core to read, or null for a schema that has none. */
const jsonSchemaOf = (schema: z.ZodType): unknown => {
    try {
        return z.toJSONSchema(schema)
    } catch {
        return null
    }
}
