import { Injectable } from "@nestjs/common"
import { BrainLessonsService } from "@modules/domain/brain-lessons"
import type { LessonRecord } from "@modules/domain/brain-lessons"
import { KnowledgeSearchService } from "@modules/domain/knowledge"
import type { Passage } from "@modules/domain/knowledge"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { DraftGuidance } from "./marketing-cards.contracts"
import { ContentAgentLogEvent } from "./content-agent.log-events"

/** The agent module whose lessons and templates a draft reads. */
const MODULE = "content"
/** How many approved lessons a draft follows at most. */
const LESSONS_MAX = 5
/** How many NIVO template passages are searched; only the base layer ones are kept. */
const PASSAGES_SEARCHED = 6
/** How many templates a draft follows at most. */
const TEMPLATES_MAX = 3
/** The longest text one guidance line carries. */
const LINE_MAX = 400

const lineOf = (title: string, body: string): string =>
    `${title}: ${body.replace(/\s+/gu, " ").trim()}`.slice(0, LINE_MAX)

@Injectable()
/**
 * What a marketing draft learns before the model writes it, read through the existing knowledge owners: the approved lessons of
 * the content agent (layer 3, learned from the owner's edits) and the NIVO marketing templates closest to the request (layer 4,
 * the `nivo` passages of the knowledge search). A failed read is logged and leaves that layer out; a draft never fails on it.
 */
export class MarketingKnowledgeService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly lessons: BrainLessonsService,
        private readonly search: KnowledgeSearchService,
    ) {}

    /** The lessons and templates for one request, as prompt lines and as the card sources they become. */
    async guidanceOf(workspaceId: string, request: string): Promise<DraftGuidance> {
        const [lessons, passages] = await Promise.all([
            this.lessons.forModule(workspaceId, MODULE).catch((cause: unknown) => this.skip(cause, workspaceId, [])),
            this.search
                .passages(
                    { workspaceId, module: MODULE, audience: "internal", installationId: null },
                    request,
                    PASSAGES_SEARCHED,
                )
                .catch((cause: unknown) => this.skip(cause, workspaceId, [])),
        ])
        const learned: ReadonlyArray<LessonRecord> = lessons.slice(0, LESSONS_MAX)
        const templates: ReadonlyArray<Passage> = passages
            .filter((passage) => passage.layer === "nivo")
            .slice(0, TEMPLATES_MAX)
        return {
            lessons: learned.map((lesson) => lineOf(lesson.title, lesson.body)),
            templates: templates.map((passage) => lineOf(passage.title, passage.content)),
            sources: [
                ...learned.map((lesson) => ({ layer: 3, ref: lesson.id, label: lesson.title })),
                ...templates.map((passage) => ({ layer: 4, ref: passage.id, label: passage.title })),
            ],
        }
    }

    private skip<T>(cause: unknown, workspaceId: string, fallback: T): T {
        this.logger.error(ContentAgentLogEvent.KnowledgeFailed, cause, { workspaceId })
        return fallback
    }
}
