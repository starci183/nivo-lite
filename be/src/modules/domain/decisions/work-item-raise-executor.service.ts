import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { EffectPayload, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import type { SubjectType } from "@modules/domain/work-items"
import { z } from "zod"
import type { WorkSpec } from "./decisions.contracts"
import { InjectWorkRaised } from "./work-engine.decorators"
import type { WorkRaisedHook } from "./work-engine.port"
import { WorkEngineService } from "./work-engine.service"

/** The name under which a graph node raises work in the Office. */
const ACTOR = "NIVO"

const raisePayload = z.object({
    action: z.string().min(1),
    title: z.string().min(1),
    payload: z.record(z.string(), z.unknown()),
    amountVnd: z.number().nonnegative().optional(),
    claimId: z.string().min(1).optional(),
})

/** The text of a payload member, or null when it is not a text. */
const textOf = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)

/** The structured fields a work item keeps: the members of the payload that are text, numbers or null. */
const fieldsOf = (payload: Readonly<Record<string, unknown>>): Readonly<Record<string, string | number | null>> =>
    Object.fromEntries(
        Object.entries(payload).filter(
            (entry): entry is [string, string | number | null] =>
                typeof entry[1] === "string" || typeof entry[1] === "number" || entry[1] === null,
        ),
    )

/** What the work is about: the order, else the customer, else the conversation of the turn. */
const subjectOf = (
    payload: Readonly<Record<string, unknown>>,
    turn: NodeTurn,
): { readonly type: SubjectType; readonly id: string | null } => {
    const orderId = textOf(payload.orderId)
    if (orderId !== null) return { type: "order", id: orderId }
    const leadId = textOf(payload.leadId)
    if (leadId !== null) return { type: "lead", id: leadId }
    return { type: "conversation", id: turn.conversationId }
}

@Injectable()
/**
 * The executor of the `work-item.raise` effect: a graph node asks a person to decide, and the work engine opens the item that waits for
 * them, once per business key. When the item answers a claim, the capability that owns claims is told through the raised hook, so the
 * engine names no claim of its own.
 */
export class WorkItemRaiseExecutorService implements OnModuleInit {
    constructor(
        private readonly engine: WorkEngineService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
        @Optional() @InjectWorkRaised() private readonly hook?: WorkRaisedHook,
    ) {}

    /** Registers the executor when the app hosts graph nodes; otherwise there is nothing to serve. */
    onModuleInit(): void {
        this.registry?.addExecutor({
            effect: "work-item.raise",
            execute: (turn, payload, call) => this.raise(turn, payload, call.dedupeKey ?? call.key),
        })
    }

    private async raise(turn: NodeTurn, payload: EffectPayload, key: string): Promise<SubjectRef> {
        const given = raisePayload.parse(payload)
        const subject = subjectOf(given.payload, turn)
        const spec: WorkSpec = {
            action: given.action,
            subject_type: subject.type,
            subject_id: subject.id,
            lead_id: textOf(given.payload.leadId),
            dedupeKey: `graph-node:work-item.raise:${key}`,
            seed: { summary: given.title, amount_vnd: given.amountVnd ?? null, fields: fieldsOf(given.payload) },
            preset: true,
            forceAsk: "branch_ask",
        }
        const item = await this.engine.runWork({ workspaceId: turn.workspaceId, actor: ACTOR, locale: turn.locale }, spec)
        if (given.claimId !== undefined) await this.hook?.raised(turn.workspaceId, given.claimId, item.id)
        return { kind: "work-item", id: item.id }
    }
}
