import { QueryHandler } from "@nestjs/cqrs"
import { BrainTodoService } from "@modules/domain/brain"
import type { BrainTodo } from "@modules/domain/brain"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BrainTodoQuery } from "./brain-todo.query"

@QueryHandler(BrainTodoQuery)
/** Counts what needs the owner in the Second Brain, three counts and never the lists. */
export class BrainTodoHandler extends ICQRSHandler<BrainTodoQuery, BrainTodo> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly todo: BrainTodoService,
    ) {
        super(logger)
    }

    protected override process(query: BrainTodoQuery): Promise<BrainTodo> {
        return this.todo.count(query.params.principal.id, query.params.request.workspaceId)
    }
}
