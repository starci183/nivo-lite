import { Injectable } from "@nestjs/common"
import { BrainFactsReadService } from "@modules/domain/brain-facts"
import { DossierFindingsService } from "@modules/domain/dossier-review"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { PublicDocumentsService } from "@modules/domain/public-documents"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"

/** Who sees the facts waiting and the customer questions; every member sees the findings. */
const MANAGERS: ReadonlySet<WorkspaceRole> = new Set(["owner", "manager"])

/** What needs the owner in the Second Brain, by kind and in all. */
export interface BrainTodo {
    /** Findings still open or confirmed. */
    readonly findings: number
    /** Cards of facts waiting for a decision. */
    readonly facts: number
    /** Customer questions nobody has answered. */
    readonly questions: number
    /** Answers NIVO found in the internal documents that wait for the owner to publish. */
    readonly proposals: number
    /** The sum: the one number the rail and the to-do tab show. */
    readonly total: number
}

@Injectable()
/**
 * The one number of what needs the owner: findings that wait, fact cards that wait, customer questions nobody answered and proposed public answers. It is four
 * counts, never the lists, so the console can ask for it on every page; the page that lists them still reads the lists.
 */
export class BrainTodoService {
    constructor(
        private readonly members: WorkspaceMembersService,
        private readonly facts: BrainFactsReadService,
        private readonly gaps: KnowledgeGapsService,
        private readonly findings: DossierFindingsService,
        private readonly documents: PublicDocumentsService,
    ) {}

    /** What needs the caller, as the caller may see it: a member who is not an owner or manager counts findings alone, as the page lists them. */
    async count(userId: string, workspaceId: string): Promise<BrainTodo> {
        const me = await this.members.require(userId, workspaceId)
        const findings = await this.findings.activeCount(workspaceId)
        if (!MANAGERS.has(me.role)) return { findings, facts: 0, questions: 0, proposals: 0, total: findings }
        const [facts, questions, proposals] = await Promise.all([
            this.facts.waitingCards(workspaceId),
            this.gaps.countOpen(workspaceId),
            this.documents.countProposals(workspaceId),
        ])
        return { findings, facts, questions, proposals, total: findings + facts + questions + proposals }
    }
}
