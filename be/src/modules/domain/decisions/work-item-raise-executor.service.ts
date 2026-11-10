import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { EffectPayload, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { TOOL } from "@nivo-lite/blocks-core"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import type { WorkSpec } from "./decisions.contracts"
import { WorkEngineService } from "./work-engine.service"
import type { PayloadMembers, RaisedSubject } from "./work-item-effects.contracts"
import { raisePayloadSchema } from "./work-item-effects.schema"
import { InstallationRecordsService } from "@modules/domain/module-installations"

/** The name under which a graph node raises work in the Office. */
const ACTOR = "NIVO"

/** The text of a payload member, or null when it is not a text. */
const textOf = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)

/** The structured fields a work item keeps: the members of the payload that are text, numbers or null. */
const fieldsOf = (payload: PayloadMembers): Readonly<Record<string, string | number | null>> =>
    Object.fromEntries(
        Object.entries(payload).filter(
            (entry): entry is [string, string | number | null] =>
                typeof entry[1] === "string" || typeof entry[1] === "number" || entry[1] === null,
        ),
    )

/** What the work is about: the order, else the customer, else the conversation of the turn. */
const subjectOf = (payload: PayloadMembers, turn: NodeTurn): RaisedSubject => {
    const orderId = textOf(payload.orderId)
    if (orderId !== null) return { type: "order", id: orderId }
    const leadId = textOf(payload.leadId)
    if (leadId !== null) return { type: "lead", id: leadId }
    return { type: "conversation", id: turn.conversationId }
}

@Injectable()
/**
 * The executor of the `work-item.raise` effect: a graph node asks a person to decide, and the work engine opens the item that waits for
 * them, once per business key. An action the catalogue does not list (a run's review, a flow's review) is a generic owner decision of
 * the raising agent's module. The amount the decision is judged by is read here from the order or the bank transaction the payload
 * names, never taken from the caller.
 */
export class WorkItemRaiseExecutorService implements OnModuleInit {
    constructor(
        private readonly engine: WorkEngineService,
        private readonly installations: InstallationRecordsService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
    ) {}

    /** Registers the executor when the app hosts graph nodes; otherwise there is nothing to serve. */
    onModuleInit(): void {
        this.registry?.addExecutor({
            effect: TOOL.workItemRaise,
            execute: (turn, payload, call) => this.raise(turn, payload, call.dedupeKey ?? call.key),
        })
    }

    private async raise(turn: NodeTurn, payload: EffectPayload, key: string): Promise<SubjectRef> {
        const given = raisePayloadSchema.parse(payload)
        const subject = subjectOf(given.payload, turn)
        const installation = await this.installations.ofAgent(turn.workspaceId, turn.agentId)
        const spec: WorkSpec = {
            action: given.action,
            ...(installation === null ? {} : { department: installation.moduleKey }),
            subject_type: subject.type,
            subject_id: subject.id,
            lead_id: textOf(given.payload.leadId),
            dedupeKey: `graph-node:work-item.raise:${key}`,
            seed: {
                summary: given.title,
                amount_vnd: await this.amountOf(turn, given.payload),
                fields: fieldsOf(given.payload),
            },
            preset: true,
            forceAsk: "branch_ask",
        }
        const item = await this.engine.runWork(
            { workspaceId: turn.workspaceId, actor: ACTOR, locale: turn.locale },
            spec,
        )
        return { kind: "work-item", id: item.id }
    }

    /**
     * The amount at stake, VND: the total of the order the payload names, else the amount of the bank transaction it names, read from
     * the records. The caller gives no amount, so a number an agent typed never reaches the owner's decision or the limit it is judged by.
     * Null when the payload names neither, or the record has no amount or cannot be read (the work is still raised).
     */
    private async amountOf(turn: NodeTurn, payload: PayloadMembers): Promise<number | null> {
        const order = await this.amountIn(turn, "order", textOf(payload.orderId))
        return order ?? (await this.amountIn(turn, "bank-transaction", textOf(payload.transactionId)))
    }

    /** The `amountVnd` of one record of a data kind, or null. */
    private async amountIn(turn: NodeTurn, kind: string, id: string | null): Promise<number | null> {
        if (id === null || this.registry === undefined) return null
        try {
            const [row] = await this.registry
                .portOf(kind)
                .read(turn, { where: { id }, fields: ["amountVnd"], limit: 1 }, "workspace")
            return typeof row?.amountVnd === "number" ? row.amountVnd : null
        } catch {
            return null
        }
    }
}
