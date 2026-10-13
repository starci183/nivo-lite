import type { CreatedWorkspace } from "@modules/domain/workspaces"
import type { CreateWorkspaceRequest } from "../../application/create-workspace.contracts"
import type { CreateWorkspaceInput } from "./dto/create-workspace.input"
import type { CreateWorkspaceType } from "./dto/create-workspace.type"

/** Maps the GraphQL input to the command request. */
export const toCreateWorkspaceRequest = (input: CreateWorkspaceInput): CreateWorkspaceRequest => ({
    name: input.name,
})

/** Maps the created workspace to the GraphQL type. */
export const toCreateWorkspaceType = (result: CreatedWorkspace): CreateWorkspaceType => ({ id: result.id })
