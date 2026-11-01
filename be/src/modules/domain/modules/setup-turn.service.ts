import { Injectable } from "@nestjs/common"
import { DirectGenerationService } from "@modules/domain/ai-generations"
import { BrainFactsService } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { SetupMessagesService } from "@modules/domain/module-setup-messages"
import type { SetupMessageRecord } from "@modules/domain/module-setup-messages"
import { SetupSessionsService } from "@modules/domain/module-setup-sessions"
import type { SetupSessionRecord } from "@modules/domain/module-setup-sessions"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { isSetupTurnPayload } from "@modules/queues/agents"
import type { SetupTurnPayload } from "@modules/queues/agents"
import { ModulesError, ModulesErrorCode } from "./errors/modules.error"
import { ModulesLogEvent } from "./modules.log-events"
import { ModulesService } from "./modules.service"
import { conflictsOf, knownLinesOf, unmentionedConflicts } from "./policies/setup-facts.policy"
import { attemptTimeoutOf, budgetLeftMs, canAttempt, canRetry, isTransient } from "./policies/setup-turn-budget.policy"
import { mergeSetupTurn, readSetupTurn, setupPromptOf } from "./policies/setup-turn.policy"
import type { SetupTurnResult } from "./policies/setup-turn.policy"
import { SetupCardsService } from "./setup-cards.service"
import { SetupGraphService } from "./setup-graph.service"

const HISTORY_TURNS = 16
/** The most facts of the business one turn reads. */
const FACTS_READ_MAX = 500
/** The most facts that match the owner message. */
const FACT_HITS_MAX = 30

/** A turn still to answer: its draft, the owner message, the chat and where the message sits in it. */
interface OpenTurn {
    readonly session: SetupSessionRecord
    readonly message: SetupMessageRecord
    readonly chat: ReadonlyArray<SetupMessageRecord>
    readonly at: number
}

/** What is on record for one turn: every fact in force of the view, and those that match the owner message. */
interface OnRecord {
    readonly inForce: ReadonlyArray<FactRecord>
    readonly hits: ReadonlyArray<FactRecord>
}

@Injectable()
/**
 * One turn of the setup chat, worked by the setup-turn job: the owner message goes to the model once with the checklist, the draft and the
 * open customer questions; what NIVO learned is merged into the draft, the writes it implies become confirm cards and its reply is the
 * next message of the chat. The reply is written last, so a job that ran before is recognised by it and never answers twice. A failure
 * that heals (the gateway, the model, an empty answer) throws, so the queue attempts the turn again by its own policy within the budget;
 * when the attempts or the budget are used up the owner is told NIVO is busy, once.
 */
export class SetupTurnService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
        private readonly facts: BrainFactsService,
        private readonly generations: DirectGenerationService,
        private readonly installations: InstallationRecordsService,
        private readonly sessions: SetupSessionsService,
        private readonly messages: SetupMessagesService,
        private readonly modules: ModulesService,
        private readonly cards: SetupCardsService,
        private readonly graph: SetupGraphService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Answers the owner message the payload names; a payload of another shape, a closed draft or a message answered already is left alone. */
    async run(payload: object): Promise<void> {
        if (!isSetupTurnPayload(payload)) return
        await this.answer(payload)
    }

    /** Runs once when the job ended as failed (the attempts are used up): the owner is told NIVO is busy unless the message was answered. */
    async giveUp(payload: object): Promise<void> {
        if (!isSetupTurnPayload(payload)) return
        const open = await this.openTurn(payload)
        if (open === null) return
        await this.reply(payload, open.session.id, this.catalog.get("generation.busy", {}, payload.locale))
    }

    /** The draft, the owner message and the chat of a turn still to answer; null when the payload is stale, closed or answered already. */
    private async openTurn(job: SetupTurnPayload): Promise<OpenTurn | null> {
        const session = await this.sessions.find(job.workspaceId, job.setupSessionId)
        const message = await this.messages.find(job.workspaceId, job.messageId)
        if (session?.status !== "draft" || message === null) return null
        const chat = await this.messages.ofSession(session.id)
        const at = chat.findIndex((line) => line.id === message.id)
        if (at < 0 || chat.slice(at + 1).some((line) => line.role === "assistant")) return null
        return { session, message, chat, at }
    }

    private async answer(job: SetupTurnPayload): Promise<void> {
        const open = await this.openTurn(job)
        if (open === null) return
        const { session, message, chat, at } = open
        const installation = await this.installations.find(job.workspaceId, session.installationId)
        if (installation === null) return
        const module = await this.modules.find(installation.moduleKey)
        const onRecord = await this.onRecordOf(job.workspaceId, module.key, installation, message.body)
        const input = {
            module,
            locale: job.locale,
            draft: session.draft,
            gates: session.gateEvidence,
            history: chat.slice(0, at).map((line) => ({ role: line.role, body: line.body })),
            message: message.body,
            gaps: await this.cards.openGapsOf(job.workspaceId, module.key),
            known: knownLinesOf(onRecord.inForce, onRecord.hits),
            graphGap: await this.graph.gapOf(job.workspaceId, installation.id),
            words: {
                notApplicable: this.catalog.get("setup.notApplicable", {}, job.locale),
                applyButton: this.catalog.get("setup.applyButton", {}, job.locale),
                ownerAddress: this.catalog.get("setup.ownerAddress", {}, job.locale),
            },
        }
        const left = budgetLeftMs(message.createdAt, this.clock.now())
        if (!canAttempt(left)) return this.reply(job, session.id, this.catalog.get("generation.busy", {}, job.locale))
        const outcome = await this.generations.run({
            workspaceId: job.workspaceId,
            purpose: "setup_chat",
            responseFormat: "json",
            timeoutMs: attemptTimeoutOf(left),
            kind: "setup",
            module: "setup",
            locale: job.locale,
            messages: [
                { role: "system", content: setupPromptOf(input) },
                ...input.history.slice(-HISTORY_TURNS).map((line) => ({ role: line.role, content: line.body })),
                { role: "user", content: input.message },
            ],
        })
        if (!outcome.ok && !isTransient(outcome.reason)) return this.reply(job, session.id, outcome.message)
        if (!outcome.ok || outcome.output.trim() === "") {
            const reason = outcome.ok ? "empty" : outcome.reason
            if (!canRetry(budgetLeftMs(message.createdAt, this.clock.now()))) {
                return this.reply(job, session.id, this.catalog.get("generation.busy", {}, job.locale))
            }
            throw new ModulesError({ code: ModulesErrorCode.SetupTurnTransient, params: { reason } })
        }
        const turn = readSetupTurn(
            input,
            outcome.output,
            this.catalog.get("setup.noted", {}, job.locale),
            this.catalog.get("setup.business", {}, job.locale),
        )
        const saved = await this.sessions.change(session.id, (current) => {
            const merged = mergeSetupTurn(current.draft, current.gateEvidence, turn)
            return { draft: merged.draft, gateEvidence: merged.gates }
        })
        if (saved === null) return
        await this.cards.propose(job.workspaceId, session.id, message.id, turn.writes)
        await this.reply(job, session.id, this.withConflictNotes(job, turn, onRecord.inForce))
    }

    /** The facts of the business the chat may read, in the scope of the instance; a failed read logs and gives none. */
    private async onRecordOf(
        workspaceId: string,
        moduleKey: string,
        installation: InstallationRecord,
        message: string,
    ): Promise<OnRecord> {
        const scope = installation.isMulti ? installation.id : null
        try {
            const inForce = await this.facts.forView(workspaceId, "internal", moduleKey, scope, FACTS_READ_MAX)
            const hits = await this.facts.search(workspaceId, "internal", moduleKey, scope, message, FACT_HITS_MAX)
            return { inForce, hits }
        } catch (cause) {
            this.logger.error(ModulesLogEvent.SetupFactsFailed, cause, { workspaceId, module: moduleKey })
            return { inForce: [], hits: [] }
        }
    }

    /** The reply, with one note per value the owner gave that differs from the one on record and the reply does not name. */
    private withConflictNotes(
        job: SetupTurnPayload,
        turn: SetupTurnResult,
        inForce: ReadonlyArray<FactRecord>,
    ): string {
        const notes = unmentionedConflicts(conflictsOf(turn.writes, inForce), turn.reply).map((conflict) =>
            this.catalog.get("setup.conflictNote", { ...conflict }, job.locale),
        )
        return [turn.reply, ...notes].join("\n\n")
    }

    private async reply(job: SetupTurnPayload, sessionId: string, body: string): Promise<void> {
        await this.messages.post({
            workspaceId: job.workspaceId,
            setupSessionId: sessionId,
            role: "assistant",
            author: "NIVO",
            body,
        })
    }
}
