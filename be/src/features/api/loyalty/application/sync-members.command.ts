import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SyncMembersRequest, SyncMembersResult } from "./sync-members.contracts"

/** Makes customers of the leads. */
export class SyncMembersCommand extends Command<SyncMembersResult> {
    constructor(readonly params: ExecuteParams<SyncMembersRequest>) {
        super()
    }
}
