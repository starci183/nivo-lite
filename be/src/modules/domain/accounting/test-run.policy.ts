import type { AccountingWaitingWorkRow } from "@modules/domain/decisions"

/** A legacy test name marker, excluded from live accounting figures. */
const TEST_RUN_PATTERN = /UAT|DBG/u
/** Whether any record label marks a test run. */
export const isTestRunName = (...names: ReadonlyArray<string | null | undefined>): boolean =>
    names.some((name) => typeof name === "string" && TEST_RUN_PATTERN.test(name))
/** Whether a waiting work item is about a test customer or proposal. */
export const isTestRunWorkItem = (item: AccountingWaitingWorkRow): boolean =>
    isTestRunName(
        item.lead?.contact_name,
        item.lead?.company,
        item.proposal.summary,
        String(item.proposal.fields.contact_name ?? ""),
        String(item.proposal.fields.customer ?? ""),
    )
