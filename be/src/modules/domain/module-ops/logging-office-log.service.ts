import { Injectable } from "@nestjs/common"
import { EventsService } from "@modules/domain/events"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { DecisionEntry, EvidenceEntry } from "./module-ops.contracts"
import { ModuleOpsLogEvent } from "./module-ops.log-events"
import { OfficeLog } from "./office-log.port"

/** The name used for a workspace until the office capability can read it. */
const PRODUCT_NAME = "NIVO"

@Injectable()
/** The office log used until the office capability is connected: evidence goes to the workspace event log, Office lines and decisions are logged only. */
export class LoggingOfficeLogService extends OfficeLog {
    constructor(
        private readonly events: EventsService,
        @InjectLogger() private readonly logger: Logger,
    ) {
        super()
    }

    /** Logs the line; it is not stored in the Office yet. */
    override postOffice(workspaceId: string, body: string): Promise<void> {
        this.logger.info(ModuleOpsLogEvent.OfficeLineLogged, { workspaceId, body })
        return Promise.resolve()
    }

    /** Appends the evidence line to the workspace event log. */
    override logEvidence(workspaceId: string, entry: EvidenceEntry): Promise<void> {
        return this.events.record({ workspaceId, kind: entry.kind, actor: entry.actor, summary: entry.summary })
    }

    /** Logs the decision; it is not stored in the decision log yet. */
    override logDecision(workspaceId: string, entry: DecisionEntry): Promise<void> {
        this.logger.info(ModuleOpsLogEvent.DecisionLogged, {
            workspaceId,
            action: entry.action,
            outcome: entry.outcome,
        })
        return Promise.resolve()
    }

    /** The product name: the workspace name is read by the office capability. */
    override workspaceName(): Promise<string> {
        return Promise.resolve(PRODUCT_NAME)
    }
}
