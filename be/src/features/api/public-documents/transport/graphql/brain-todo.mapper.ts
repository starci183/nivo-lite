import type { BrainTodo } from "@modules/domain/brain"
import type { BrainTodoRequest } from "../../application/brain-todo.contracts"
import type { BrainTodoType } from "./dto/brain-todo.type"

/** Maps the workspace of the call to the request. */
export const toBrainTodoRequest = (workspaceId: string): BrainTodoRequest => ({ workspaceId })

/** The count already has the shape of the GraphQL type. */
export const toBrainTodoType = (result: BrainTodo): BrainTodoType => result
