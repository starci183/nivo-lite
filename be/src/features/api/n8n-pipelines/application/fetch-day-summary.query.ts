import { Query } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { DaySummary } from "@modules/domain/n8n-runs"
import type { FetchDaySummaryRequest } from "./fetch-day-summary.contracts"

/** Reads the figures of a day for the daily report workflow. */
export class FetchDaySummaryQuery extends Query<DaySummary> {
    constructor(readonly params: PublicExecuteParams<FetchDaySummaryRequest>) {
        super()
    }
}
