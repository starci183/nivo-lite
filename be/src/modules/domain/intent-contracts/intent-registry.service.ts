import { Injectable } from "@nestjs/common"
import { IntentContractsError, IntentContractsErrorCode } from "./errors/intent-contracts.error"
import { REQUEST_CHECKS } from "./intent-check.policy"
import type {
    IntentCheckKey,
    IntentContract,
    IntentFrame,
    IntentReading,
    IntentResultKind,
    IntentTrigger,
} from "./intent-contracts.contracts"
import { OWN_TURN_RESULT, REQUEST_RESULT, answerNeeded, frameOfIntent } from "./intent-frames.policy"
import type {
    FrameAction,
    IntentCheck,
    IntentDomain,
    IntentLookup,
    IntentResultSchema,
    OptionalIntentCheck,
    OptionalIntentFrame,
    OptionalResultSchema,
    PinnedIntent,
} from "./intent-policies.contracts"
import { readIntentResult } from "./intent-reading.policy"
import { agentRequestSchema, ownTurnPickSchema } from "./intent-result.schema"

/** A key is a bounded lower-case word: it is stored in a version and written in a message key. */
const KEY_SHAPE = /^[a-z][a-z0-9_]{0,63}$/u

@Injectable()
/**
 * The intents a turn can pick from, by domain. The generic request, its result and its checks are always there; a domain adds its frames,
 * the schema of each result it defines and the function of each check it defines in `onModuleInit`. A frame that names a result or a check
 * nobody registered throws at registration, so a wiring bug stops the start and never a customer's turn.
 */
export class IntentRegistryService implements IntentLookup {
    private readonly frames: Array<IntentFrame> = []
    private readonly results = new Map<IntentResultKind, IntentResultSchema>([
        [REQUEST_RESULT, agentRequestSchema],
        [OWN_TURN_RESULT, ownTurnPickSchema],
    ])
    private readonly checks = new Map<IntentCheckKey, IntentCheck>(Object.entries(REQUEST_CHECKS))

    /** Registers a domain. */
    add(domain: IntentDomain): void {
        for (const [key, schema] of Object.entries(domain.results)) this.keep(this.results, key, schema)
        for (const [key, check] of Object.entries(domain.checks)) this.keep(this.checks, key, check)
        for (const frame of domain.frames) this.keepFrame(frame)
    }

    /** The frame an intent runs under for a trigger, or null when it has none. */
    frameOf(intent: string, actions: ReadonlyArray<FrameAction>, trigger: IntentTrigger): OptionalIntentFrame {
        return frameOfIntent(this.frames, intent, actions, trigger)
    }

    /** True when a turn of this trigger must have an intent that answers to pick from. */
    needsAnswer(trigger: IntentTrigger): boolean {
        return answerNeeded(this.frames, trigger)
    }

    /** The schema registered under a key, or undefined. */
    resultSchemaOf(kind: IntentResultKind): OptionalResultSchema {
        return this.results.get(kind)
    }

    /** The check registered under a key, or undefined. */
    checkOf(key: IntentCheckKey): OptionalIntentCheck {
        return this.checks.get(key)
    }

    /** Reads what a turn answered against the contracts it was offered. */
    read(text: string, contracts: ReadonlyArray<IntentContract>, pinned: PinnedIntent = null): IntentReading {
        return readIntentResult(text, contracts, pinned, this)
    }

    private keep<Value>(table: Map<string, Value>, key: string, value: Value): void {
        if (!KEY_SHAPE.test(key))
            throw new IntentContractsError({ code: IntentContractsErrorCode.KeyInvalid, params: { key } })
        if (table.has(key))
            throw new IntentContractsError({ code: IntentContractsErrorCode.KeyDuplicate, params: { key } })
        table.set(key, value)
    }

    private keepFrame(frame: IntentFrame): void {
        for (const key of [frame.result, ...frame.checks]) {
            if (!KEY_SHAPE.test(key))
                throw new IntentContractsError({ code: IntentContractsErrorCode.KeyInvalid, params: { key } })
        }
        for (const key of [frame.result]) this.require(this.results.has(key), key)
        for (const key of frame.checks) this.require(this.checks.has(key), key)
        const twin = this.frames.some(
            (held) => held.intent === frame.intent && held.triggers.some((trigger) => frame.triggers.includes(trigger)),
        )
        this.require(!twin, frame.intent, IntentContractsErrorCode.KeyDuplicate)
        this.frames.push(frame)
    }

    private require(
        ok: boolean,
        key: string,
        code: IntentContractsErrorCode = IntentContractsErrorCode.KeyUnknown,
    ): void {
        if (!ok) throw new IntentContractsError({ code, params: { key } })
    }
}
