import { NIVO_API } from "@nivo-lite/agent-sdk/names"
import type { NivoApiOpGroup } from "@modules/domain/nivo-api"
import { AccountDataRowsPageService } from "@modules/domain/account-data"
import { AccountDataRowsHandler } from "./application/account-data-rows.handler"
import { AccountDataRowsQuery, AccountDataTypesQuery } from "./application/account-data-rows.queries"
import { AccountDataTypesHandler } from "./application/account-data-types.handler"

/** The account data ops of the outbound MCP surface: the message each op sends to the connections handlers, with those handlers. */
export const CONNECTIONS_NIVO_API_OPS: NivoApiOpGroup = {
    handlers: [AccountDataRowsPageService, AccountDataTypesHandler, AccountDataRowsHandler],
    queries: {
        [NIVO_API.accountData.typeList]: AccountDataTypesQuery,
        [NIVO_API.accountData.rowList]: AccountDataRowsQuery,
    },
    commands: {},
}
