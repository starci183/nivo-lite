import { Injectable, type OnModuleInit } from "@nestjs/common"
import { proposalTextOf } from "@modules/domain/agent-turns"
import {
    AgentWorkHandlersService,
    type AgentHandlerEnding,
    type AgentTurnPrep,
    type AgentTurnView,
    type AgentWakeView,
    type AgentWakeSource,
    type AgentWorkHandler,
} from "@modules/domain/agent-work"
import { ChatTurnService, type CustomerTurn } from "@modules/domain/conversations"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { CustomerCorePlanService } from "./customer-core-plan.service"
import { CustomerIntentSettleService } from "./customer-intent-settle.service"
import { CustomerTurnRuntimeService } from "./customer-turn-runtime.service"
import { holdReasonOf, isStaleWake, turnRefOf } from "./customer-turn.policy"

/** Why a wake ends without a turn: the message or the conversation it names is gone, or its wake carries no ids. */
const TARGET_GONE = "target_gone"
/** Why a wake ends without a turn: a person took the conversation over and answers it themselves. */
const TAKEN_OVER = "taken_over"
/** Why a customer wake is held over instead of answered: it waited longer than a question can. */
const STALE = "stale"

const ended = (status: AgentHandlerEnding["status"], reason: string | null, outcome: unknown): AgentHandlerEnding => ({
    status,
    reason,
    outcome,
})

/** The customer turn with the turn and wake it runs under, so the work it opens carries them; a wake that ended with no turn carries none. */
const underWake = (loaded: CustomerTurn, wake: AgentWakeView | AgentTurnView): CustomerTurn =>
    "turnId" in wake ? { ...loaded, origin: { turnId: wake.turnId, wakeId: wake.wakeId } } : loaded

@Injectable()
/**
 * The customer's side of the work core. A customer wake runs the takeover check, the holding line (at most once per hour),
 * `CustomerOutcomesService.settle` and the reply stored once per message, which are the methods of `ChatTurnService`, called here under
 * the lease. The handler adds what only a wake has: a wake older than ten minutes is held over, and a
 * model turn runs in the executor, under its gates, between `prepare` and `settle`. Every effect is idempotent per customer message, so a
 * retried wake or a stored proposal repeats nothing. A turn the published graph holds contracts for settles through the contract pipeline
 * instead (`CustomerIntentSettleService`), whose door reaches the same `respond`.
 */
export class CustomerWorkHandlerService implements AgentWorkHandler, OnModuleInit {
    /** The source this handler answers: a customer's message. */
    readonly sources: ReadonlyArray<AgentWakeSource> = ["customer"]

    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly handlers: AgentWorkHandlersService,
        private readonly chat: ChatTurnService,
        private readonly runtime: CustomerTurnRuntimeService,
        private readonly plans: CustomerCorePlanService,
        private readonly intents: CustomerIntentSettleService,
    ) {}

    /** Registers the handler with the drain once the app has started. */
    onModuleInit(): void {
        this.handlers.add(this)
    }

    /** Ends the wake when a person holds the conversation or it is too old; otherwise builds the plan of the turn. */
    async prepare(turn: AgentTurnView): Promise<AgentTurnPrep> {
        const loaded = await this.load(turn)
        if (loaded === undefined) return { kind: "end", ending: ended("skipped", TARGET_GONE, null) }
        if (this.chat.answeredByPerson(loaded)) return { kind: "end", ending: ended("skipped", TAKEN_OVER, null) }
        if (isStaleWake(turn.wakeCreatedAt, this.clock.now())) {
            return { kind: "end", ending: await this.hold(loaded, turn, STALE) }
        }
        const ready = await this.chat.ready(loaded, turn.context.lookupName === true)
        const plan = await this.plans.planOf(ready, turn)
        if (typeof plan === "string") return { kind: "end", ending: await this.hold(ready, turn, plan) }
        return { kind: "run", plan }
    }

    /** Reads the model's text as the proposal and puts it through the outcome handler; the reply is stored and sent once per message. */
    async settle(turn: AgentTurnView, proposal: unknown, signal: AbortSignal): Promise<AgentHandlerEnding> {
        const loaded = await this.load(turn)
        if (loaded === undefined) return ended("skipped", TARGET_GONE, null)
        const intended = await this.intents.settle(turn, proposalTextOf(proposal), signal)
        if (intended !== null) {
            this.plans.end(loaded)
            return intended
        }
        await this.chat.respond(underWake(loaded, turn), this.runtime.proposalFrom(proposalTextOf(proposal)))
        this.plans.end(loaded)
        return ended("done", null, { replied: true })
    }

    /** Answers a turn that cannot run (quota, breaker, a runtime that is down, a switch): the owner's holding line and a question for a person. */
    async holdOver(turn: AgentWakeView, reason: string): Promise<AgentHandlerEnding> {
        const loaded = await this.load(turn)
        if (loaded === undefined) return ended("skipped", TARGET_GONE, null)
        return this.hold(loaded, turn, reason)
    }

    private async hold(loaded: CustomerTurn, turn: AgentWakeView, reason: string): Promise<AgentHandlerEnding> {
        await this.chat.holdOver(underWake(loaded, turn), holdReasonOf(reason))
        this.plans.end(loaded)
        return ended("done", reason, { heldOver: true })
    }

    private async load(turn: AgentWakeView): Promise<CustomerTurn | undefined> {
        const ref = turnRefOf(turn.context)
        return ref === null ? undefined : this.chat.turnOf(turn.workspaceId, ref)
    }
}
