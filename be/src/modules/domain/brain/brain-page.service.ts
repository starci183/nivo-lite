import { Injectable } from "@nestjs/common"
import { AgentsService, type AgentSummary } from "@modules/domain/agents"
import { BrainExtractionsService, type ExtractionState } from "@modules/domain/brain-extractions"
import { BrainFactsPagingService, FACTS_PAGE_MAX, type FactPageFilter, type FactRecord } from "@modules/domain/brain-facts"
import { BrainCommandsService } from "@modules/domain/brain-commands"
import { BrainLessonsService, type LessonRecord } from "@modules/domain/brain-lessons"
import { KnowledgeGapsService, type GapRecord } from "@modules/domain/knowledge-gaps"
import { MODULE_CATALOG } from "@modules/domain/modules"
import { WorkspaceMembersService, type WorkspaceRole } from "@modules/domain/workspace-members"
import { BrainError, BrainErrorCode } from "./errors/brain.error"

/** Who may change the brain, and who sees the facts, the unanswered questions and the reading of each document. */
const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

/** What page of the facts the caller asks for: the first page of `FACTS_PAGE_MAX` with the default statuses when nothing is said. */
export interface BrainFactsAsk extends FactPageFilter {
    /** At most this many facts (capped at `FACTS_PAGE_MAX`). */
    readonly first?: number | undefined
    /** The cursor of the page before, or null / absent for the first page. */
    readonly after?: string | null | undefined
}

/** The most unanswered questions the page lists (the most asked first); the count covers all of them. */
const GAPS_LIMIT = 50

/** One agent the owner can look through: its module, name and the audience it answers. */
export interface BrainLens {
    /** The module of the agent. */
    readonly module: string
    /** The display name of the agent. */
    readonly name: string
    /** customer or internal. */
    readonly audience: string
}

/** The lens of each module's first active agent; an agent of a module outside the catalogue has none. */
const lensesOf = (agents: ReadonlyArray<AgentSummary>): ReadonlyArray<BrainLens> => {
    const seen = new Set<string>()
    return agents.flatMap((agent): ReadonlyArray<BrainLens> => {
        const definition = MODULE_CATALOG.find((item) => item.key === agent.module)
        if (agent.status !== "active" || definition === undefined || seen.has(agent.module)) return []
        seen.add(agent.module)
        return [{ module: agent.module, name: agent.name, audience: definition.audience }]
    })
}

/** Where the study of an agent's corrections stands. */
export interface LessonMiningState {
    /** The command. */
    readonly id: string
    /** queued, running, done or failed. */
    readonly status: string
    /** How many corrections there were, once done. */
    readonly corrections: number | null
    /** How many were kept as new regression cases, once done. */
    readonly newCases: number | null
    /** How many lessons were proposed, once done. */
    readonly proposed: number | null
    /** Why nothing was proposed, when so. */
    readonly reason: string | null
    /** The stored code of why it failed. */
    readonly errorCode: string | null
}

/** The number a stored result holds under a name, or null. */
const countOf = (result: object | null, name: string): number | null => {
    const value: unknown = result === null ? undefined : Reflect.get(result, name)
    return typeof value === "number" ? value : null
}

/** Everything the Second Brain page shows. */
export interface BrainOverview {
    /** One page of the facts in force, waiting or scheduled (or of the statuses asked), newest change first. */
    readonly facts: ReadonlyArray<FactRecord>
    /** How many facts match in all (SQL count); more than `facts.length` means there are more pages. */
    readonly factsTotal: number
    /** The cursor of the next page of facts, or null when this is the last. */
    readonly factsNextCursor: string | null
    /** The lessons in force, waiting or retired. */
    readonly lessons: ReadonlyArray<LessonRecord>
    /** The customer questions nobody answered, the most asked first. */
    readonly gaps: ReadonlyArray<GapRecord>
    /** How many questions are open in all. */
    readonly gapsOpen: number
    /** Where the reading of each document stands. */
    readonly extractions: ReadonlyArray<ExtractionState>
    /** The agents the owner can look through. */
    readonly lenses: ReadonlyArray<BrainLens>
}

@Injectable()
/**
 * What the Second Brain page reads, and the slow work it asks for. The facts, the customer questions and the reading of each
 * document are for owners and managers; a staff member gets the lessons only, as before.
 */
export class BrainPageService {
    constructor(
        private readonly members: WorkspaceMembersService,
        private readonly facts: BrainFactsPagingService,
        private readonly lessons: BrainLessonsService,
        private readonly gaps: KnowledgeGapsService,
        private readonly extractions: BrainExtractionsService,
        private readonly commands: BrainCommandsService,
        private readonly agents: AgentsService,
    ) {}

    /**
     * The brain of the workspace as the caller may see it. The facts are one keyset page (BRAIN-LIMITS item 4): with no `ask` the first
     * page of 2,000 in force, waiting or scheduled, newest change first (what the page read before, now with its total and the cursor of
     * the rest), so a caller that pages nothing still gets what it got.
     */
    async overview(userId: string, workspaceId: string, asked: BrainFactsAsk | null = {}): Promise<BrainOverview> {
        const ask = asked ?? {}
        const me = await this.members.require(userId, workspaceId)
        const lessons = await this.lessons.list(workspaceId, ["active", "proposed", "retired"])
        const lenses = lensesOf(await this.agents.list(userId, workspaceId))
        if (!MANAGERS.includes(me.role)) {
            return { facts: [], factsTotal: 0, factsNextCursor: null, lessons, gaps: [], gapsOpen: 0, extractions: [], lenses }
        }
        const [page, gaps, gapsOpen, extractions] = await Promise.all([
            this.facts.page(workspaceId, ask, ask.first ?? FACTS_PAGE_MAX, ask.after ?? null),
            this.gaps.list(workspaceId, ["open"], GAPS_LIMIT),
            this.gaps.countOpen(workspaceId),
            this.extractions.states(workspaceId),
        ])
        return {
            facts: page.facts,
            factsTotal: page.total,
            factsNextCursor: page.nextCursor,
            lessons,
            gaps,
            gapsOpen,
            extractions,
            lenses,
        }
    }

    /** Asks the brain to study the corrections of one agent; the job proves the role again. Answers the command to follow. */
    async requestMining(userId: string, workspaceId: string, module: string): Promise<string> {
        await this.members.require(userId, workspaceId, MANAGERS)
        return this.commands.request(userId, workspaceId, "lessons.mine", { module })
    }

    /** How the study of an agent's corrections stands for the person who asked for it. */
    async miningState(userId: string, workspaceId: string, id: string): Promise<LessonMiningState> {
        const state = await this.commands.stateOf(userId, workspaceId, id)
        if (state === null) throw new BrainError({ code: BrainErrorCode.CommandNotFound })
        const reason: unknown = state.result === null ? undefined : Reflect.get(state.result, "reason")
        return {
            id,
            status: state.status,
            corrections: countOf(state.result, "corrections"),
            newCases: countOf(state.result, "newCases"),
            proposed: countOf(state.result, "proposed"),
            reason: typeof reason === "string" ? reason : null,
            errorCode: state.errorCode,
        }
    }
}
