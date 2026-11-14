import { Query } from "@nestjs/cqrs"
import type { BrainTodo } from "@modules/domain/brain"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { BrainTodoRequest } from "./brain-todo.contracts"

/** Counts what needs the owner in the Second Brain: fact cards, customer questions and proposals. */
export class BrainTodoQuery extends Query<BrainTodo> {
    constructor(readonly params: ExecuteParams<BrainTodoRequest>) {
        super()
    }
}
