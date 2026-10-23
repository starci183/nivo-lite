import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetMcpConnectorCredentialRequest } from "./set-mcp-connector-credential.contracts"

/** Sets or rotates the sealed bearer credential of a remote connector and reads its catalog with it. */
export class SetMcpConnectorCredentialCommand extends Command<number> {
    constructor(readonly params: ExecuteParams<SetMcpConnectorCredentialRequest>) {
        super()
    }
}
