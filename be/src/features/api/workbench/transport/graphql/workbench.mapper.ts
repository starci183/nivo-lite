import type { DoorAnswer } from "@modules/domain/workbench-door"
import type { WorkbenchRequest } from "../../application/workbench.contracts"
import type { WorkbenchActionInput } from "./dto/workbench-action.input"
import type { WorkbenchAnswerType } from "./dto/workbench-answer.type"
import type { WorkbenchReadInput } from "./dto/workbench-read.input"

/** Maps the bounded read arguments and the selected workspace into the door request. */
export const toWorkbenchReadRequest = (workspaceId: string, input: WorkbenchReadInput): WorkbenchRequest => ({
    workspaceId,
    name: input.name,
    payload: input.vars,
})

/** Maps the bounded action arguments and the selected workspace into the door request. */
export const toWorkbenchActionRequest = (workspaceId: string, input: WorkbenchActionInput): WorkbenchRequest => ({
    workspaceId,
    name: input.name,
    payload: input.input,
})

/** Maps the door answer to the GraphQL type. */
export const toWorkbenchAnswerType = (answer: DoorAnswer): WorkbenchAnswerType => ({ data: answer.data })
