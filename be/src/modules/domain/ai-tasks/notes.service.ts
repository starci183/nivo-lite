import { Injectable } from "@nestjs/common"
import type { AiContext } from "@modules/integrations/ai"
import type { AiTaskScope } from "./ai-tasks.contracts"
import { InjectAiTaskRecall } from "./ai-tasks.decorators"
import type { AiTaskRecall } from "./ai-tasks.port"

/** How many passages of the Second Brain a drafting task puts in its prompt as business notes. */
const NOTES_LIMIT = 4

@Injectable()
/**
 * The retrieval step of a drafting task. The Second Brain search stays the owner of what an agent may read (its lane, audience and
 * instance); this only wraps that search for the chain, so one question costs one embedding and the notes join one model call.
 */
export class NotesService {
    constructor(@InjectAiTaskRecall() private readonly recall: AiTaskRecall) {}

    /** The retrieval for a drafting task of the scope; null when the scope names no lane or the task has no question. */
    contextOf(scope: AiTaskScope, question: string | null): AiContext | null {
        const { lane } = scope
        if (lane === undefined || question === null) return null
        return {
            question,
            limit: NOTES_LIMIT,
            search: async (asked) => {
                const found = await this.recall.notes({
                    workspaceId: scope.workspaceId,
                    ...lane,
                    question: asked,
                    limit: NOTES_LIMIT,
                })
                return found.map((passage) => ({ title: passage.title, content: passage.content }))
            },
        }
    }
}
