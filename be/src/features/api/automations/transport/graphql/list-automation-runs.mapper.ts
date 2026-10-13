import type { AutomationRunView } from "@modules/domain/automations"
import type { ListRunsRequest } from "../../application/list-runs.contracts"
import type { AutomationRunsInput } from "./dto/automation-runs.input"
import type { AutomationRunType } from "./dto/automation-run.type"

/** Maps the GraphQL input to the query request; an absent template asks for every template. */
export const toListRunsRequest = (workspaceId: string, input: AutomationRunsInput): ListRunsRequest => ({
    workspaceId,
    templateKey: input.template,
})

/** Maps the run history to the GraphQL types. */
export const toAutomationRunTypes = (result: ReadonlyArray<AutomationRunView>): Array<AutomationRunType> =>
    result.map((run) => ({ ...run }))
