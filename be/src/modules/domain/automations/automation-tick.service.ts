import { Injectable } from "@nestjs/common"
import { AutomationEngineService } from "./automation-engine.service"

@Injectable()
/** Runs the scheduled engine pass of the minute tick job; business facts reach the engine through the event bus reactors. */
export class AutomationTickService {
    constructor(private readonly engine: AutomationEngineService) {}

    /** Runs the tick: the due runs, the scans and the extension ticks. */
    async run(): Promise<void> {
        await this.engine.tickNow()
    }
}
