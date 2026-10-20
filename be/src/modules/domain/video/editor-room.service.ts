import { Injectable } from "@nestjs/common"
import { OfficeLinesService } from "@modules/domain/messages"
import type { WorkContext } from "@modules/domain/decisions"
import type { EditorCard } from "./editor-delegation.contracts"

/** The department whose agent speaks AI Editor's lines (the video module; the Hub routes it to the Marketing room). */
const EDITOR_DEPARTMENT = "video"

@Injectable()
/**
 * Where AI Editor talks in the Hub. Until the Hub's card writer is merged, a card is posted as its one-line preview through the Office
 * lines (spoken by the video agent, linked to the work item, so the Hub routes it to the Marketing room); the full v1 card is kept on the
 * delegation row. After the merge this is the only place that changes: post the card through the Hub's card writer instead.
 */
export class EditorRoomService {
    constructor(private readonly lines: OfficeLinesService) {}

    /** Posts a card as its preview line, linked to the work item it is about. */
    async post(scope: WorkContext, preview: string, card: EditorCard, workItemId: string): Promise<void> {
        await this.lines.post(scope, {
            body: card.link === undefined ? preview : `${preview} (${card.link.href})`,
            lead_id: null,
            work_item_id: workItemId,
            dept: EDITOR_DEPARTMENT,
        })
    }

    /** Posts a plain line of AI Editor. */
    async say(scope: WorkContext, body: string, workItemId: string): Promise<void> {
        await this.lines.post(scope, { body, lead_id: null, work_item_id: workItemId, dept: EDITOR_DEPARTMENT })
    }
}
