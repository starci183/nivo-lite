import { QueryHandler } from "@nestjs/cqrs"
import { WorkspaceShellService } from "@modules/domain/workspaces"
import type { ShellFacts } from "@modules/domain/workspaces"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetShellQuery } from "./get-shell.query"

@QueryHandler(GetShellQuery)
/** Answers the console frame facts from the shell service. */
export class GetShellHandler extends ICQRSHandler<GetShellQuery, ShellFacts> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly shell: WorkspaceShellService,
    ) {
        super(logger)
    }

    protected override process(query: GetShellQuery): Promise<ShellFacts> {
        return this.shell.read(query.params.principal.id, query.params.request.workspaceId, {
            from: query.params.request.foundingFrom,
            to: query.params.request.foundingTo,
        })
    }
}
