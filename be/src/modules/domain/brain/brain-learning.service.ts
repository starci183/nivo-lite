import { Injectable } from "@nestjs/common"
import { BrainEvalCasesService } from "@modules/domain/brain-eval-cases"
import { BrainLessonsService } from "@modules/domain/brain-lessons"
import type { LessonEvidence } from "@modules/domain/brain-lessons"
import { UsageMeterService } from "@modules/domain/knowledge"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectLlm } from "@modules/integrations/llm"
import type { LlmPort } from "@modules/integrations/llm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectBrainOptions } from "./brain.decorators"
import type { BrainOptions } from "./brain.options"
import type { MineResult } from "./brain.contracts"
import { ModelJsonService } from "./model-json.service"
import { LEARN_SYSTEM, MIN_CORRECTIONS, learnPrompt, parseLessons } from "./learn.policy"

/** Who may ask the brain to study the agents' corrections. */
const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

/** How far back corrections are studied. */
const WINDOW_DAYS = 90

/** The most corrections studied at once. */
const MAX_CORRECTIONS = 60

/** How long the model may take. */
const LEARN_TIMEOUT_MS = 60_000

@Injectable()
/**
 * Self-learning, the reviewed way. The model never changes itself: what changes is the brain. Every correction the owner made of an
 * agent's work is kept as a regression case, and recurring patterns across the corrections are filed as PROPOSED lessons, each citing its
 * decisions. Nothing reaches an agent until an owner or manager approves the lesson. The model call is NIVO's: metered, never billed
 * to the workspace allowance.
 */
export class BrainLearningService {
    constructor(
        @InjectBrainOptions() private readonly options: BrainOptions,
        @InjectLlm() private readonly llm: LlmPort,
        private readonly members: WorkspaceMembersService,
        private readonly lessons: BrainLessonsService,
        private readonly cases: BrainEvalCasesService,
        private readonly usage: UsageMeterService,
        private readonly json: ModelJsonService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Turns one agent's recent corrections into regression cases and proposed lessons. */
    async mine(userId: string, workspaceId: string, module: string): Promise<MineResult> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const since = new Date(this.clock.now().getTime() - WINDOW_DAYS * 86_400_000)
        const list = await this.options.corrections.recent(workspaceId, module, since, MAX_CORRECTIONS)
        const newCases = await this.cases.keep(
            workspaceId,
            module,
            list.map((item) => ({
                originRef: `decision:${item.decisionId}`,
                input: { action: item.action, proposal: item.before },
                expected: { outcome: item.outcome, proposal: item.after, note: item.note },
            })),
        )
        if (list.length < MIN_CORRECTIONS)
            return { corrections: list.length, newCases, proposed: 0, reason: "not_enough" }
        const existing = (await this.lessons.list(workspaceId, ["active", "proposed"]))
            .filter((lesson) => lesson.module === module || lesson.module === null)
            .map((lesson) => `- ${lesson.title}: ${lesson.body}`)
        const prompt = learnPrompt(existing, list)
        const answer = await this.llm.complete({ system: LEARN_SYSTEM, prompt, timeoutMs: LEARN_TIMEOUT_MS })
        if (answer === null) return { corrections: list.length, newCases, proposed: 0, reason: "model_unavailable" }
        await this.usage.record({
            workspaceId,
            kind: "guide",
            module: "other",
            model: answer.model,
            usage: answer.usage,
            promptChars: LEARN_SYSTEM.length + prompt.length,
            completionChars: answer.text.length,
        })
        const known = new Set(list.map((item) => item.decisionId))
        let proposed = 0
        await eachInOrder(parseLessons(this.json.jsonOf(answer.text)), async (lesson) => {
            // A lesson must stand on at least two real corrections.
            const ids = [...new Set(lesson.decisions)].filter((id) => known.has(id))
            if (ids.length < 2) return
            const evidence: Array<LessonEvidence> = ids.map((id) => {
                const correction = list.find((item) => item.decisionId === id)
                return {
                    kind: "decision",
                    ref: id,
                    label: correction === undefined ? id : `${correction.action} · ${correction.outcome}`,
                    at: correction?.at,
                }
            })
            await this.lessons.propose(workspaceId, {
                module,
                title: lesson.title,
                body: lesson.body,
                appliesWhen: lesson.appliesWhen,
                origin: "edits",
                evidence,
                proposedBy: "NIVO",
            })
            proposed += 1
        })
        return { corrections: list.length, newCases, proposed }
    }
}
