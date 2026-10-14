import { Injectable } from "@nestjs/common"
import type { AutomationOwnerChat } from "./automation-ports.contracts"

@Injectable()
/** Keeps the report in Office when no owner-chat adapter is registered. */
export class NullAutomationOwnerChat implements AutomationOwnerChat {
    /** Reports that the owner's chat was not reached. */
    sendToOwner(_workspaceId: string, _text: string): Promise<boolean> {
        return Promise.resolve(false)
    }
}
