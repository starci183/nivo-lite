import { HubNotesService } from "@modules/domain/customer-turns"
import type { LiteWorld } from "./lite-world.service"

/** Posts a fixture card through the real Hub-note service and its transactional inbox claim. */
export const hubNoteProof = (world: LiteWorld, workspaceId: string) => ({
    postOnce(title: string, agentId: string, key: string): Promise<void> {
        return world.resolve(HubNotesService).postOnce(
            {
                workspaceId,
                room: "sales",
                type: "action_done",
                title,
                authorName: "AI Sales",
                fields: [{ label: "Tool", value: "hakuen.booking.hold" }],
            },
            agentId,
            { leadId: null, workItemId: null },
            key,
        )
    },
})
