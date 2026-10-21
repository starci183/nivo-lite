import { Injectable } from "@nestjs/common"
import { OfficeCardsService, OfficeLinesService } from "@modules/domain/messages"
import type { WorkContext } from "@modules/domain/decisions"
import type { EditorCard } from "./editor-delegation.contracts"

/** The department whose agent speaks AI Editor's lines (the video module). */
const EDITOR_DEPARTMENT = "video"

/** The Hub room AI Editor's cards go to: the delegation comes from AI Marketing. */
const EDITOR_ROOM = "marketing"

@Injectable()
/**
 * Where AI Editor talks in the Hub: a card is posted as a Hub result card (spoken by the video agent, linked to the work item, in the
 * Marketing room) with its one-line preview; a plain line goes through the Office lines.
 */
export class EditorRoomService {
    constructor(
        private readonly lines: OfficeLinesService,
        private readonly cards: OfficeCardsService,
    ) {}

    /** Posts a card with its preview line, linked to the work item it is about; answers the id of the posted message. */
    async post(scope: WorkContext, preview: string, card: EditorCard, workItemId: string): Promise<string> {
        const posted = await this.cards.postAsDepartment({ workspaceId: scope.workspaceId }, EDITOR_DEPARTMENT, {
            room: EDITOR_ROOM,
            body: preview,
            leadId: null,
            workItemId,
            card,
        })
        return posted.id
    }

    /** Posts a plain line of AI Editor. */
    async say(scope: WorkContext, body: string, workItemId: string): Promise<void> {
        await this.lines.post(scope, { body, lead_id: null, work_item_id: workItemId, dept: EDITOR_DEPARTMENT })
    }
}
