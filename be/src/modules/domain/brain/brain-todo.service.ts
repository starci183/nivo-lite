import { Injectable } from "@nestjs/common"
import { BrainFactsReadService } from "@modules/domain/brain-facts"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { PublicDocumentsService } from "@modules/domain/public-documents"
import { WorkspaceMembersService, type WorkspaceRole } from "@modules/domain/workspace-members"

/** Who sees the facts waiting, the customer questions and the proposals: the inbox is theirs. */
const MANAGERS: ReadonlySet<WorkspaceRole> = new Set(["owner", "manager"])

/** What needs the owner in the Second Brain, by kind and in all. */
export interface BrainTodo {
    /** Cards of facts waiting for a decision. */
    readonly facts: number
    /** Customer questions nobody has answered. */
    readonly questions: number
    /** Answers NIVO found in the internal documents that wait for the owner to publish. */
    readonly proposals: number
    /** The inbox of the to-do tab: fact cards, open questions and proposals. The one number the rail and the tab show. */
    readonly total: number
}

@Injectable()
/**
 * The one number of what needs the owner: fact cards that wait, customer questions nobody answered and proposed public answers (the
 * inbox of the to-do tab). It is counts, never the lists, so the console can ask for it on every page; the page that lists them still
 * reads the lists.
 */
export class BrainTodoService {
    constructor(
        private readonly members: WorkspaceMembersService,
        private readonly facts: BrainFactsReadService,
        private readonly gaps: KnowledgeGapsService,
        private readonly documents: PublicDocumentsService,
    ) {}

    /** What needs the caller, as the caller may see it: a member who is not an owner or manager has no inbox. */
    async count(userId: string, workspaceId: string): Promise<BrainTodo> {
        const me = await this.members.require(userId, workspaceId)
        if (!MANAGERS.has(me.role)) return { facts: 0, questions: 0, proposals: 0, total: 0 }
        const [facts, questions, proposals] = await Promise.all([
            this.facts.waitingCards(workspaceId),
            this.gaps.countOpen(workspaceId),
            this.documents.countProposals(workspaceId),
        ])
        return { facts, questions, proposals, total: facts + questions + proposals }
    }
}
