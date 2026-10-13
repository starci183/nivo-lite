import type { AutomationSuggestion } from "@modules/domain/automations"
import type { SuggestAutomationsRequest } from "../../application/suggest-automations.contracts"
import type { AutomationSuggestionsInput } from "./dto/automation-suggestions.input"
import type { AutomationSuggestionType } from "./dto/automation-suggestion.type"

/** Maps the GraphQL input to the query request; an absent module asks for the workspace-wide templates. */
export const toSuggestAutomationsRequest = (
    workspaceId: string,
    input: AutomationSuggestionsInput,
): SuggestAutomationsRequest => ({ workspaceId, moduleKey: input.module })

/** Maps the suggestions to the GraphQL types. */
export const toAutomationSuggestionTypes = (
    result: ReadonlyArray<AutomationSuggestion>,
): Array<AutomationSuggestionType> => result.map((suggestion) => ({ ...suggestion }))
