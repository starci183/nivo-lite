import { Injectable, Optional, type OnModuleInit } from "@nestjs/common"
import type { EffectPayload, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { GraphNodeRegistryService, type NodeTurn } from "@modules/domain/graph-nodes"
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
 * the raising agent's module.
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
            effect: "work-item.raise",
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
            seed: { summary: given.title, amount_vnd: given.amountVnd ?? null, fields: fieldsOf(given.payload) },
            preset: true,
            forceAsk: "branch_ask",
        }
        const item = await this.engine.runWork(
            { workspaceId: turn.workspaceId, actor: ACTOR, locale: turn.locale },
            spec,
        )
        return { kind: "work-item", id: item.id }
    }
}
