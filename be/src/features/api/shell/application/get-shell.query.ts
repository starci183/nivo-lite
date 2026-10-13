import { Query } from "@nestjs/cqrs"
import type { ShellFacts } from "@modules/domain/shell"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetShellRequest } from "./get-shell.contracts"

/** Asks for the facts the console frame of the caller's workspace draws. */
export class GetShellQuery extends Query<ShellFacts> {
    constructor(readonly params: ExecuteParams<GetShellRequest>) {
        super()
    }
}
