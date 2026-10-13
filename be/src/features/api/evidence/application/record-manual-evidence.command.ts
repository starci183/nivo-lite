import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RecordManualEvidenceRequest } from "./record-manual-evidence.contracts"

/** Admits one piece of manual evidence: money the owner knows arrived. */
export class RecordManualEvidenceCommand extends Command<boolean> {
    constructor(readonly params: ExecuteParams<RecordManualEvidenceRequest>) {
        super()
    }
}
