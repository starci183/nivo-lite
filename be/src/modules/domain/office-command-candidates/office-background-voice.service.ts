import { Injectable } from "@nestjs/common"
import type { BackgroundLine, BackgroundVoice } from "@modules/domain/agent-schedules"
import { OfficeLinesService } from "@modules/domain/messages"

@Injectable()
/**
 * The Office half of the background voice: what an agent has to say to its owner after a turn nobody waited on is one line in the main
 * room, spoken by the agent. A line is said once per wake: the same words by the same agent since the wake was written are not said
 * again, so a settle that is retried from its stored proposal adds nothing.
 */
export class OfficeBackgroundVoiceService implements BackgroundVoice {
    constructor(private readonly lines: OfficeLinesService) {}

    /** Says the line in the main room as the agent, unless it already did since the wake. */
    say(line: BackgroundLine): Promise<void> {
        return this.lines.post(
            { workspaceId: line.workspaceId },
            {
                body: line.text,
                lead_id: null,
                work_item_id: null,
                room: null,
                agent_id: line.agentId,
                unlessSaidSince: line.wakeCreatedAt,
            },
        )
    }
}
