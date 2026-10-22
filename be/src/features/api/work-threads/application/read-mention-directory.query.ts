import { Query } from "@nestjs/cqrs"
import type { MentionDirectory } from "@modules/domain/thread-messages"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReadMentionDirectoryRequest } from "./read-mention-directory.contracts"

/** Asks for the people, agents and groups a composer can tag. */
export class ReadMentionDirectoryQuery extends Query<MentionDirectory> {
    constructor(readonly params: ExecuteParams<ReadMentionDirectoryRequest>) {
        super()
    }
}
