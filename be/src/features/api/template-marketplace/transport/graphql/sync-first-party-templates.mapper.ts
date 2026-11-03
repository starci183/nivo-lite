import type { FirstPartySyncReport } from "@modules/domain/template-marketplace"
import type { FirstPartySyncReportType } from "./dto/first-party-sync-report.type"
import { toFirstPartySyncReportType } from "./template-marketplace.records.mapper"

/** Maps the answer to the GraphQL type. */
export const toSyncFirstPartyTemplatesType = (result: FirstPartySyncReport): FirstPartySyncReportType =>
    toFirstPartySyncReportType(result)
