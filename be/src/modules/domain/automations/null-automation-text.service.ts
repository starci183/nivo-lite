import { Injectable } from "@nestjs/common"
import type { AutomationText, AutomationTextRequest, GeneratedText } from "./automation-ports.contracts"

@Injectable()
/** Keeps deterministic wording when no text generator is configured. */
export class NullAutomationText implements AutomationText {
    /** Answers none for every text request. */
    generate(_request: AutomationTextRequest): Promise<GeneratedText> {
        return Promise.resolve(null)
    }
}
