import { Injectable } from "@nestjs/common"
import type { ConnectionFieldChange, ConnectionFieldWriter, ProviderFieldsDeclaration } from "@modules/domain/connection-fields"
import { ConnectionsService, type ConnectionActor, type ConnectionRecord } from "@modules/domain/connections"
import { ZALO_FIELD_DECLARATIONS } from "./zalo-connection-fields.policy"
import { ZaloConnectService } from "./zalo-connect.service"

@Injectable()
/** The connection form writer of a Zalo OA: the OA Secret Key through `saveOaSecret` (the connect step's own write), the name through the connections rename. */
export class ZaloConnectionFieldsService implements ConnectionFieldWriter {
    /** The form of a Zalo OA. */
    readonly declarations: ReadonlyArray<ProviderFieldsDeclaration> = ZALO_FIELD_DECLARATIONS

    constructor(
        private readonly zalo: ZaloConnectService,
        private readonly connections: ConnectionsService,
    ) {}

    /** Seals a new OA Secret Key when one is given, then renames when asked. */
    async write(actor: ConnectionActor, connection: ConnectionRecord, change: ConnectionFieldChange): Promise<void> {
        const secret = change.values.oaSecret
        if (secret !== undefined) await this.zalo.saveOaSecret(actor, connection.id, secret)
        if (change.displayName !== null) await this.connections.rename(actor, connection.id, change.displayName)
    }
}
