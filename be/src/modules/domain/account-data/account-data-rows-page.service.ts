import { Injectable } from "@nestjs/common"
import { ConnectionsService, type ConnectionActor } from "@modules/domain/connections"
import type {
    AccountDataRowsAnswer,
    AccountDataRowsRequest,
    AccountDataTypeDef,
    AccountDataTypeView,
} from "./account-data.contracts"
import { AccountDataReadService } from "./account-data-read.service"
import { AccountDataTypesService } from "./account-data-types.service"

/** The page size when the request names none. */
const PAGE_SIZE = 20

/** The largest page. */
const PAGE_MAX = 100

/** True when an account of this provider stores rows of the type (a type of no provider is any provider's). */
const isOfProvider = (type: AccountDataTypeDef, provider: string): boolean => type.provider === null || type.provider === provider

@Injectable()
/**
 * The raw data a connected account keeps (`account_data`), for an owner or a manager of the workspace, through the same guard as the
 * connection page's account-data counts (`AccountDataPageService.statsFor`): the seat first, then the connection must be one of the
 * workspace (another workspace's is not found). Rows are the provider's data as the intake took it: a type's secret members never
 * reach the store (the intake refuses a value that holds one), so none is answered here.
 */
export class AccountDataRowsPageService {
    constructor(
        private readonly connections: ConnectionsService,
        private readonly declared: AccountDataTypesService,
        private readonly reads: AccountDataReadService,
    ) {}

    /** The declared types an account of this connection's provider stores. */
    async types(actor: ConnectionActor, connectionId: string): Promise<ReadonlyArray<AccountDataTypeView>> {
        await this.connections.authorize(actor, ["owner", "manager"])
        const connection = await this.connections.get(actor.workspaceId, connectionId)
        return this.declared
            .all()
            .filter((type) => isOfProvider(type, connection.provider))
            .map((type) => ({
                type: type.name,
                provider: type.provider,
                version: type.version,
                write: type.write,
                fields: Object.keys(type.fields),
            }))
    }

    /** The newest rows of one declared type of the account, newest first. */
    async rows(actor: ConnectionActor, request: AccountDataRowsRequest): Promise<AccountDataRowsAnswer> {
        await this.connections.authorize(actor, ["owner", "manager"])
        const connection = await this.connections.get(actor.workspaceId, request.connectionId)
        const type = this.declared.of(request.type)
        if (type === null) return { refusal: "type_unknown", rows: [] }
        if (!isOfProvider(type, connection.provider)) return { refusal: "type_not_of_account", rows: [] }
        const limit = Math.min(Math.max(request.limit ?? PAGE_SIZE, 1), PAGE_MAX)
        const rows = await this.reads.newest(connection.id, type.name, limit)
        return {
            refusal: null,
            rows: rows.map((row) => ({
                id: row.id,
                key: row.key,
                typeVersion: row.typeVersion,
                occurredAt: row.occurredAt.toISOString(),
                value: row.value,
            })),
        }
    }
}
