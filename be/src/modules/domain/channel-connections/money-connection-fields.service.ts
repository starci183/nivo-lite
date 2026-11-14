import { Injectable } from "@nestjs/common"
import type {
    ConnectionFieldChange,
    ConnectionFieldWriter,
    FieldRefusal,
    ProviderFieldsDeclaration,
} from "@modules/domain/connection-fields"
import type { ConnectionActor, ConnectionRecord } from "@modules/domain/connections"
import { ChannelConnectionsService } from "./channel-connections.service"
import { MONEY_FIELD_DECLARATIONS, moneyRefusalsOf, moneyUpdateOf } from "./money-connection-fields.policy"

@Injectable()
/** The connection form writer of the bank and payment feeds: every change goes through `updateMoneyConnection`, as the wizard's edit does. */
export class MoneyConnectionFieldsService implements ConnectionFieldWriter {
    /** The forms of SePay, Casso and payOS. */
    readonly declarations: ReadonlyArray<ProviderFieldsDeclaration> = MONEY_FIELD_DECLARATIONS

    constructor(private readonly channels: ChannelConnectionsService) {}

    /** The values the feed's own edit would refuse, found with its own rule functions before anything is written. */
    check(_connection: ConnectionRecord, change: ConnectionFieldChange): ReadonlyArray<FieldRefusal> {
        return moneyRefusalsOf(change)
    }

    /** Applies the change through the feed's own edit (owner only, validated and sealed there). */
    async write(actor: ConnectionActor, connection: ConnectionRecord, change: ConnectionFieldChange): Promise<void> {
        await this.channels.updateMoneyConnection(actor, connection.id, moneyUpdateOf(connection, change))
    }
}
