import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { AccountExpectedPosition, AccountOwner, OptionalStoredRow } from "./account-data.contracts"
import { storedRowOf } from "./account-data.mapper"
import { accountExternalIdOf, insertedIdOf, isConnectionId } from "./account-data.policy"
import { AccountDataTypesService } from "./account-data-types.service"
import { checkedRowOf, isForward, positionOf, rowValuesOf } from "./account-data-value.policy"
import { AccountDataEntity } from "./persistence/entities"

@Injectable()
/**
 * The positions of `advance` types (how far a poller or an agent has read): one row per key that only moves forward. Every move is ONE
 * compare-and-set statement: the first move inserts-or-ignores the row, every later one updates it only while the stored position is
 * still the one the mover read, so of two movers from the same position exactly one wins.
 */
export class AccountCursorsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly bindings: ConnectionBindingsReadService,
        private readonly types: AccountDataTypesService,
    ) {}

    /** The stored position row under the key; null when there is none yet. */
    async read(connectionId: string, type: string, key: string, manager?: EntityManager): Promise<OptionalStoredRow> {
        this.types.declaredAs(type, ["advance"])
        const row = await (manager ?? this.entityManager).findOne(AccountDataEntity, {
            where: { type, connectionId, key: accountExternalIdOf(key) },
        })
        return row === null ? null : storedRowOf(row)
    }

    /**
     * Writes `value` only when the stored position equals `expected` (null = no row yet) AND the value's position is greater than it;
     * false when another writer moved it first, the move is not forward, or the connection names no account. The value is checked
     * against the declaration like every write (VALUE_INVALID, SECRET_IN_VALUE, VALUE_TOO_LARGE); its key is derived from it.
     */
    async advance(
        connectionId: string,
        type: string,
        expected: AccountExpectedPosition,
        value: object,
        manager?: EntityManager,
    ): Promise<boolean> {
        const tx = manager ?? this.entityManager
        if (!isConnectionId(connectionId)) return false
        const account = await this.bindings.accountOf(connectionId, tx)
        if (account === null) return false
        const def = this.types.declaredAs(type, ["advance"], account.provider)
        const row = checkedRowOf(def, value)
        const owner: AccountOwner = { provider: account.provider, connectionId, workspaceId: account.workspaceId }
        if (expected === null) {
            const inserted = await tx
                .createQueryBuilder(AccountDataEntity, "r")
                .insert()
                .values(rowValuesOf(owner, row))
                .orIgnore()
                .returning("id")
                .execute()
            return insertedIdOf(inserted.raw) !== null
        }
        if (!isForward(positionOf(def, row.value), expected)) return false
        const moved = await tx
            .createQueryBuilder(AccountDataEntity, "r")
            .update()
            .set({
                value: row.value,
                typeVersion: def.version,
                occurredAt: row.occurredAt ?? (() => "now()"),
            })
            .where("type = :type AND connection_id = :connectionId AND key = :key", {
                type,
                connectionId,
                key: row.key,
            })
            .andWhere(`value ->> '${def.position ?? ""}' = :expected`, { expected: String(expected) })
            .execute()
        return (moved.affected ?? 0) > 0
    }
}
