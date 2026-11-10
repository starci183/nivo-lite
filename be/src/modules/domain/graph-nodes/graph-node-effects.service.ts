import { createHash } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { isRefused, type EffectCall, type SubjectRef } from "@nivo-lite/agent-sdk/node"
import { cursorScopeOf, type Query } from "@nivo-lite/agent-sdk/query"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { EntityEngineService, EntityMutationService } from "@modules/domain/entity-engine"
import { isDomainError } from "@modules/platform/errors"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import {
    EffectOutcomeUnknownCode,
    EffectOutcomeUnknownError,
    GraphNodesError,
    GraphNodesErrorCode,
    isOutcomeUnknownCode,
} from "./errors/graph-nodes.error"
import type { EffectAct } from "./graph-nodes.contracts"
import { GraphNodesLogEvent } from "./graph-nodes.log-events"

/** The longest key the ledger keeps (`agent.node-effect.effectKey`). */
const KEY_MAX = 200

/**
 * The ledger key of a call: its business key when the node named one, else the run step's own (the step, then a digest of the effect
 * and its arguments, which the runner makes). A key too long for the ledger is kept as its digest: the same call gives the same digest.
 */
export const ledgerKeyOf = (call: EffectCall): string => {
    const key = call.dedupeKey === null ? `call:${call.key}` : `dedupe:${call.dedupeKey}`
    return key.length <= KEY_MAX ? key : `digest:${createHash("sha256").update(key).digest("hex")}`
}

/** The entity of the ledger. */
const LEDGER = "agent.node-effect"

/** The cursor scope of the ledger lookup (it never pages past its one row). */
const LOOKUP_SCOPE = cursorScopeOf("graph-nodes.effect", {}, "id")

/** The kind a ledger record names as its subject when its act ended with an outcome nobody knows (see `OUTCOME_UNKNOWN_CODES`). */
export const OUTCOME_UNKNOWN_KIND = "outcome-unknown"

/** The codes an act ends with when its effect may or may not have happened (`EffectOutcomeUnknownCode`). */
export const OUTCOME_UNKNOWN_CODES: ReadonlySet<string> = new Set(Object.values(EffectOutcomeUnknownCode))

/** The run and the step a call was made for. */
export interface CallPlace {
    /** The run. */
    readonly runId: string
    /** The step of the run (its key in the graph). */
    readonly stepKey: string
}

/** A step's call key: `<run id>:<step key>:<digest>` (the runner's), or `<run id>:<step key>:undo:<n>` (an undo of the old kernel). */
const STEP_CALL_KEY = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(.+?)(?::undo:\d+|:[^:]+)$/i

/** The run and the step of a call, read from its key; null for a key of another shape (a gateway operation key). */
export const placeOf = (callKey: string): CallPlace | null => {
    const [, runId, stepKey] = STEP_CALL_KEY.exec(callKey) ?? []
    return runId === undefined || stepKey === undefined || stepKey.length > KEY_MAX ? null : { runId, stepKey }
}

/** The bounds the ledger's JSON fields hold (`agent.node-effect.args` / `facts`, blocks-core `boundedRecord`). */
const JSON_TEXT_MAX = 20_000
const JSON_ENTRIES_MAX = 1_000
const JSON_DEPTH_MAX = 24

/** A JSON record as the ledger's `args` and `facts` fields hold it. */
export type LedgerJson = { readonly [key: string]: JsonValue }

/** True when a plain JSON value fits the ledger's bounds. */
const fits = (value: unknown, depth: number): value is JsonValue => {
    if (depth > JSON_DEPTH_MAX) return false
    if (value === null || typeof value === "boolean") return true
    if (typeof value === "number") return Number.isFinite(value)
    if (typeof value === "string") return value.length <= JSON_TEXT_MAX
    if (Array.isArray(value)) return value.length <= JSON_ENTRIES_MAX && value.every((item) => fits(item, depth + 1))
    if (typeof value !== "object") return false
    const entries = Object.entries(value)
    return entries.length <= JSON_ENTRIES_MAX && entries.every(([name, item]) => name.length <= KEY_MAX && fits(item, depth + 1))
}

/** The plain record of a value, or null. */
const recordOf = (value: unknown): Readonly<Record<string, unknown>> | null =>
    typeof value === "object" && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : null

/** A value that cannot be kept as JSON (a function, a symbol, a big integer, a cycle too deep). */
const NOT_JSON: unique symbol = Symbol("not-json")

/** The JSON a value stands for, as `JSON.stringify` would write it (a time as ISO text; an absent member left out), or `NOT_JSON`. */
const jsonOf = (value: unknown, depth: number): JsonValue | undefined | typeof NOT_JSON => {
    if (depth > JSON_DEPTH_MAX) return NOT_JSON
    if (value === undefined) return undefined
    if (value === null || typeof value === "string" || typeof value === "boolean") return value
    if (typeof value === "number") return Number.isFinite(value) ? value : null
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
    if (Array.isArray(value)) {
        const items = value.map((item) => jsonOf(item, depth + 1))
        return items.includes(NOT_JSON) ? NOT_JSON : items.map((item) => (item === undefined || item === NOT_JSON ? null : item))
    }
    const record = recordOf(value)
    if (record === null) return NOT_JSON
    const entries = Object.entries(record).map(([name, item]): [string, JsonValue | undefined | typeof NOT_JSON] => [
        name,
        jsonOf(item, depth + 1),
    ])
    if (entries.some(([, item]) => item === NOT_JSON)) return NOT_JSON
    return Object.fromEntries(
        entries.flatMap(([name, item]): Array<[string, JsonValue]> =>
            item === undefined || item === NOT_JSON ? [] : [[name, item]],
        ),
    )
}

/** True for a JSON record within the ledger's bounds. */
const isLedgerJson = (value: unknown): value is LedgerJson =>
    typeof value === "object" && value !== null && !Array.isArray(value) && fits(value, 0)

/**
 * A record as the ledger keeps it: plain JSON within the field's bounds, or null when it is none or does not fit. An argument or a
 * fact the ledger cannot hold is left out; it is never a reason to fail the write of an effect that already acted.
 */
export const ledgerJsonOf = (value: unknown): LedgerJson | null => {
    if (recordOf(value) === null) return null
    const plain = jsonOf(value, 0)
    return isLedgerJson(plain) ? plain : null
}

/** What the ledger kept under a key: the effect that ran and the subject it touched, with the facts it answered when kept. */
interface Kept {
    /** The effect the key was written by. */
    readonly effect: string
    /** The data kind and the id of the record the first run touched, with its facts. */
    readonly subject: SubjectRef
}

/** What a ledger record kept, or null for a record that holds no subject. */
const keptOf = (data: Readonly<Record<string, unknown>>): Kept | null => {
    if (typeof data.effectId !== "string" || typeof data.subjectEntity !== "string" || typeof data.subjectId !== "string")
        return null
    const facts = recordOf(data.facts)
    const subject: SubjectRef = { kind: data.subjectEntity, id: data.subjectId }
    return { effect: data.effectId, subject: facts === null ? subject : { ...subject, facts } }
}

/** The lookup of one ledger key. */
const lookupOf = (ledgerKey: string): Query => ({
    from: LEDGER,
    select: ["effectId", "subjectEntity", "subjectId", "facts"],
    where: { op: "eq", field: "effectKey", value: ledgerKey },
    order: [["id", "asc"]],
    page: { size: 1 },
})

/** The most records of one run step the ledger reads back (a step makes a handful of calls). */
export const STEP_RECORDS_READ = 100

/** The cursor scope of the read of a run step's records. */
const STEP_SCOPE = cursorScopeOf("graph-nodes.effect-step", {}, "id")

/** The read of a run step's records, oldest first, served by the ledger's `run_step` index (run, step, id). */
const stepQueryOf = (place: CallPlace): Query => ({
    from: LEDGER,
    select: ["effectId", "subjectEntity", "subjectId", "args", "facts"],
    where: {
        op: "and",
        of: [
            { op: "eq", field: "runId", value: place.runId },
            { op: "eq", field: "stepKey", value: place.stepKey },
        ],
    },
    order: [["id", "asc"]],
    page: { size: STEP_RECORDS_READ },
})

/** One effect a run step made, as the ledger kept it: what ran, with what, what it touched and answered, and when. */
export interface LedgerRecord {
    /** The effect. */
    readonly effect: string
    /** The arguments the call ran with; null when they were not kept (a record from before they were, or too large to keep). */
    readonly args: Readonly<Record<string, unknown>> | null
    /** The subject it touched, with the facts it answered when kept; of kind `outcome-unknown` when nobody knows whether it acted. */
    readonly subject: SubjectRef
    /** When it was kept (ISO text): just after the act. */
    readonly at: string
}

/** Where a call is made and with what, as its caller knows it. */
export interface CallRecord {
    /** The arguments (the checked payload) the call runs with; absent, none are kept. */
    readonly args?: Readonly<Record<string, unknown>> | undefined
    /** The run and the step; absent, read from the call key (`placeOf`). */
    readonly place?: CallPlace | undefined
}

/** The code a throw carries: a domain error's, or the `code` member of another object; null when it carries none. */
const thrownCodeOf = (cause: unknown): unknown => {
    if (isDomainError(cause)) return cause.code
    return typeof cause === "object" && cause !== null ? Reflect.get(cause, "code") : null
}

/** The outcome-unknown code an act threw, or null for any other throw. */
const unknownCodeOf = (cause: unknown): string | null => {
    const code = thrownCodeOf(cause)
    return isOutcomeUnknownCode(code) ? code : null
}

/** Whether the ledger kept a call whose outcome nobody knows; the write's failure when it could not. */
type UnknownKept = { readonly kept: true } | { readonly kept: false; readonly cause: unknown }

@Injectable()
/**
 * The ledger that makes a node's effect act once, kept as `agent.node-effect` records through the entity engine. Before acting, a key
 * already written answers its subject and the facts it answered; the act itself runs outside any transaction (an effect may call a
 * door, BE-PERSISTENCE-6); after acting, the subject is written once under the entity's unique key, with the run, the step, the
 * arguments and the facts of the call (D.1: what a step already did is read back from here, across conversations and attempts), and
 * when two runs raced, both answer the subject of the record that won. A refusal (`{ kind: "refused" }`) is never written: it changed
 * nothing, and a kept refusal would be replayed for ever. An act that ends with an outcome nobody knows is written as such and answers
 * that same outcome for ever after: no machine makes the call again, only a person decides. A key answers only the effect that wrote
 * it: a key another effect holds is refused before anything acts, so one tool's result is never handed to another.
 */
export class GraphNodeEffectsService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly mutations: EntityMutationService,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Runs the act once per key in the workspace and answers the subject the first run touched. */
    async once(
        workspaceId: string,
        effect: string,
        call: EffectCall,
        act: EffectAct,
        record: CallRecord = {},
    ): Promise<SubjectRef> {
        const ledgerKey = ledgerKeyOf(call)
        const before = await this.recorded(workspaceId, ledgerKey)
        if (before !== null) {
            if (before.effect !== effect) {
                throw new GraphNodesError({
                    code: GraphNodesErrorCode.EffectKeyTaken,
                    params: { effect, heldBy: before.effect },
                })
            }
            this.logger.info(GraphNodesLogEvent.EffectReplayed, { workspaceId, effect })
            if (before.subject.kind === OUTCOME_UNKNOWN_KIND && isOutcomeUnknownCode(before.subject.id))
                throw new EffectOutcomeUnknownError({ code: before.subject.id, params: { effect } })
            return before.subject
        }
        const place = record.place ?? placeOf(call.key)
        const args = ledgerJsonOf(record.args)
        const values: LedgerJson = {
            effectKey: ledgerKey,
            effectId: effect,
            ...(place === null ? {} : { runId: place.runId, stepKey: place.stepKey }),
            ...(args === null ? {} : { args }),
        }
        const subject = await act().catch(async (cause: unknown) => {
            const code = unknownCodeOf(cause)
            if (code !== null) await this.keepUnknown(workspaceId, values, code)
            throw cause
        })
        // A refusal is an answer, not an act: nothing is kept under the key, so the call asked again later is really made again.
        if (isRefused(subject)) return subject
        const facts = ledgerJsonOf(subject.facts)
        const written = await this.engine.scoped(workspaceId, (tx) =>
            this.mutations.mutate(
                tx,
                {
                    op: "insert",
                    entity: LEDGER,
                    values: {
                        ...values,
                        subjectEntity: subject.kind,
                        subjectId: subject.id,
                        ...(facts === null ? {} : { facts }),
                    },
                },
                "job",
            ),
        )
        if (written.ok) return subject
        const winner = written.reason === "taken" ? await this.recorded(workspaceId, ledgerKey) : null
        if (winner?.effect !== effect) {
            throw new GraphNodesError({ code: GraphNodesErrorCode.EffectNotRecorded, params: { effect } })
        }
        return winner.subject
    }

    /**
     * The effects a run step made, oldest first, as the ledger kept them (every attempt of the step, whatever conversation each call
     * addressed), cut to the effects named; empty when the step made none. Records written before the run and the step were kept are
     * not found here.
     */
    async recordsOf(
        workspaceId: string,
        place: CallPlace,
        effects: ReadonlyArray<string>,
    ): Promise<ReadonlyArray<LedgerRecord>> {
        const page = await this.engine.scoped(workspaceId, (tx) => this.engine.list(tx, stepQueryOf(place), STEP_SCOPE))
        return page.rows.flatMap(({ row }) => {
            const kept = keptOf(row.data)
            return kept === null || !effects.includes(kept.effect)
                ? []
                : [{ effect: kept.effect, args: recordOf(row.data.args), subject: kept.subject, at: row.createdAt }]
        })
    }

    /** What the ledger kept for a key, or null when the key is not written. */
    private async recorded(workspaceId: string, ledgerKey: string): Promise<Kept | null> {
        const page = await this.engine.scoped(workspaceId, (tx) =>
            this.engine.list(tx, lookupOf(ledgerKey), LOOKUP_SCOPE),
        )
        const [first] = page.rows
        return first === undefined ? null : keptOf(first.row.data)
    }

    /**
     * Keeps a call whose act ended with an outcome nobody knows, so it is never made again by a machine. Best effort: the act's own
     * error is what the caller gets either way (a failed keep is answered, not thrown, so it never hides that error); a key another
     * attempt wrote meanwhile keeps what that attempt wrote.
     */
    private keepUnknown(workspaceId: string, values: LedgerJson, code: string): Promise<UnknownKept> {
        return this.engine
            .scoped(workspaceId, (tx) =>
                this.mutations.mutate(
                    tx,
                    {
                        op: "insert",
                        entity: LEDGER,
                        values: { ...values, subjectEntity: OUTCOME_UNKNOWN_KIND, subjectId: code, facts: { code } },
                    },
                    "job",
                ),
            )
            .then(
                (): UnknownKept => ({ kept: true }),
                (cause: unknown): UnknownKept => ({ kept: false, cause }),
            )
    }
}
