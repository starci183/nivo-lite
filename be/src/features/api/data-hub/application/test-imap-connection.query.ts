import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { TestImapConnectionRequest } from "./test-imap-connection.contracts"

/** Logs in to a mailbox read only and lists its folders. */
export class TestImapConnectionQuery extends Query<Array<string>> {
    constructor(readonly params: ExecuteParams<TestImapConnectionRequest>) {
        super()
    }
}
