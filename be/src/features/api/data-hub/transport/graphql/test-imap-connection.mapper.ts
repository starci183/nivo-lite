import type { TestImapConnectionRequest } from "../../application/test-imap-connection.contracts"
import type { ImapFoldersType } from "./dto/imap-folders.type"
import type { TestImapConnectionInput } from "./dto/test-imap-connection.input"
import { toImapInput } from "./imap-connection.mapper"

/** Maps the GraphQL arguments of testImapConnection to the request. */
export const toTestImapConnectionRequest = (
    workspaceId: string,
    input: TestImapConnectionInput,
): TestImapConnectionRequest => ({ workspaceId, input: toImapInput(input) })

/** Maps the folder list to the GraphQL type. */
export const toImapFoldersType = (folders: Array<string>): ImapFoldersType => ({ folders })
