import { Injectable, type OnModuleInit } from "@nestjs/common"
import { INTENT_STEP_KIND, IntentSplitService, doorInputSchema, type DoorInput } from "@modules/domain/agent-turns"
import { AgentRunHandlersService, type StepAnswer, type StepView } from "@modules/domain/agent-runs"
import { ChatTurnService, type ChatTurnProposal, type CustomerTurn } from "@modules/domain/conversations"
import { parseJsonText } from "@modules/platform/primitives"
import { CustomerFinalReplyService } from "./customer-final-reply.service"
import { CustomerTurnRuntimeService } from "./customer-turn-runtime.service"
import { turnRefOf } from "./customer-turn.policy"
import type { ProposingReading } from "./customer-intent.contracts"

/** The longest draft a person is given to reuse. */
const DRAFT_MAX = 1500
/** Why a step cannot run: its row does not hold what the door needs. */
const INVALID_INPUT = "invalid_step_input"

@Injectable()
/**
 * The door of a customer turn on the contract pipeline, run from its row alone. A picked intent is the reply contract's own result, read
 * as it always was; the safe road is the holding line, a question for a person and the model's text kept as a draft, with the gap the
 * model named; a split writes the follow-up wake and sends nothing. The reply always goes through `ChatTurnService.respond`, once per
 * message, so a retried step repeats nothing. A run that dies here tells the customer the honest holding line.
 */
export class CustomerDoorStepService implements OnModuleInit {
    constructor(
        private readonly handlers: AgentRunHandlersService,
        private readonly chat: ChatTurnService,
        private readonly runtime: CustomerTurnRuntimeService,
        private readonly split: IntentSplitService,
        private readonly final: CustomerFinalReplyService,
    ) {}

    /** Registers the door with the run engine once the app has started. */
    onModuleInit(): void {
        this.handlers.add({
            kind: INTENT_STEP_KIND.customerDoor,
            run: (step) => this.run(step),
            deadLetter: (step) => this.deadLetter(step),
        })
    }

    private async run(step: StepView): Promise<StepAnswer> {
        const input = doorInputSchema.safeParse(step.input)
        if (!input.success) return { kind: "failed", code: INVALID_INPUT }
        const { wake, reading } = input.data
        if (reading.kind === "split") {
            const fired = await this.split.fire(wake, reading.contract.intent)
            return { kind: "done", result: { replied: false, split: true, fired }, next: [] }
        }
        const owed = this.final.owedOf(step.earlier)
        const turn = await this.turnOf(input.data, owed !== null)
        if (turn === undefined) return { kind: "done", result: { replied: false, skipped: "target_gone" }, next: [] }
        await this.chat.respond(turn, this.proposalOf(reading, input.data.moneyText))
        return { kind: "done", result: { replied: true, split: false }, next: owed === null ? [] : [owed] }
    }

    private async deadLetter(step: StepView): Promise<void> {
        const input = doorInputSchema.safeParse(step.input)
        if (!input.success) return
        const turn = await this.turnOf(input.data, false)
        if (turn !== undefined) await this.chat.holdOver(turn, "error")
    }

    /** The customer turn the wake of the row names, carrying the turn and wake its work is opened under. */
    private async turnOf(input: DoorInput, finalOwed: boolean): Promise<CustomerTurn | undefined> {
        const { wake } = input
        const ref = turnRefOf(wake.context)
        const loaded = ref === null ? undefined : await this.chat.turnOf(wake.workspaceId, ref)
        return loaded === undefined
            ? undefined
            : { ...loaded, ...(finalOwed ? { finalOwed } : {}), origin: { turnId: wake.turnId, wakeId: wake.wakeId } }
    }

    /** The proposal the outcome gate decides on: the reply contract's result as the model gave it, or the safe road. */
    private proposalOf(reading: ProposingReading, moneyText: string | undefined): ChatTurnProposal {
        const proposal = this.proposalOfReading(reading)
        const money = moneyText === undefined ? null : parseJsonText(moneyText)
        return money?.ok === true ? { ...proposal, detail: { ...proposal.detail, money: money.value } } : proposal
    }

    private proposalOfReading(reading: ProposingReading): ChatTurnProposal {
        if (reading.kind === "picked") return this.runtime.proposalFrom(reading.resultText)
        const holding = this.runtime.proposalFrom("")
        return {
            ...holding,
            proposedAnswer: reading.draft.slice(0, DRAFT_MAX),
            detail: { ...holding.detail, knowledge_gap: reading.gap },
        }
    }
}
