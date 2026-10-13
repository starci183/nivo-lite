import { Query } from "@nestjs/cqrs"
import type { PreviewImportOutput } from "@modules/domain/shifts"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { PreviewShiftsImportRequest } from "./preview-shifts-import.contracts"

/** Asks what the quick import text would add, without writing it. */
export class PreviewShiftsImportQuery extends Query<PreviewImportOutput> {
    constructor(readonly params: ExecuteParams<PreviewShiftsImportRequest>) {
        super()
    }
}
