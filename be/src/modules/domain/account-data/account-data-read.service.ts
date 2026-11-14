import { Injectable } from "@nestjs/common"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    AccountDataStats,
    AccountDataTypeDef,
    AccountMemberFilter,
    AccountMemberValue,
    EnteredRow,
    OptionalEnteredPoint,
    OptionalIdentifiedRow,
    OptionalStoredRow,
    StoredRow,
} from "./account-data.contracts"
import { accountExternalIdOf, byName, readLimitOf, valueOf } from "./account-data.policy"
import { storedRowOf } from "./account-data.mapper"
import { AccountDataTypesService } from "./account-data-types.service"
import { AccountDataErrorCode } from "./errors/account-data.error"
import { AccountDataEntity } from "./persistence/entities"

/** One row of the entered-order read, as the database answers it. */
interface EnteredRaw {
    /** The row id. */
    readonly id: string
    /** The type. */
    readonly type: string
    /** The version of the fields. */
    readonly typeVersion: number
    /** The row key. */
    readonly key: string
    /** The value. */
    readonly value: object
    /** When it happened. */
    readonly occurredAt: Date
    /** When it was completed. */
    readonly processedAt: Date | null
    /** `created_at` fixed-width in UTC with microseconds. */
    readonly createdAt: string
}

/** One row read by its id, as the database answers it. */
interface IdentifiedRaw extends EnteredRaw {
    /** The connection. */
    readonly connectionId: string
}

/** `created_at` fixed-width in UTC with microseconds (`2026-11-11T10:00:00.123000Z`), so two compare by code unit in time order. */
const CREATED_AT_UTC = `to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`

/** One row of the stats read. */
interface StatsRaw {
    /** The type. */
    readonly type: string
    /** How many rows, as the database counts them (text). */
    readonly rows: string
    /** The newest time. */
    readonly newestAt: Date | null
}

/** The member expression of an indexed member, cast as the generated index casts it so the index serves the read. */
const indexedMemberSql = (def: AccountDataTypeDef, field: string): string => {
    const text = `(r.value ->> '${field}')`
    switch (def.fields[field]?.type) {
        case "integer":
            return `CAST(${text} AS bigint)`
        case "number":
            return `CAST(${text} AS numeric)`
        case "boolean":
            return `CAST(${text} AS boolean)`
        case "text":
        case "timestamp":
        case "json":
        case undefined:
            return text
    }
}

@Injectable()
/**
 * Reads of an account's own data: always one connection and one declared type (the partition), newest first on the index
 * `(connection_id, type, occurred_at DESC)`, or in the order rows entered the store for cursor readers. A row older than its type's
 * `ttlMs` reads as absent (on the database clock). Nothing here calls the provider.
 */
export class AccountDataReadService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly types: AccountDataTypesService,
    ) {}

    /** The row of the account under the key; null when there is none or it expired. */
    async get(connectionId: string, type: string, key: string, manager?: EntityManager): Promise<OptionalStoredRow> {
        const def = this.types.declared(type)
        const row = await this.rowsOf(def, connectionId, manager)
            .andWhere("r.key = :key", { key: accountExternalIdOf(key) })
            .limit(1)
            .getOne()
        return row === null ? null : storedRowOf(row)
    }

    /** The newest rows of the type, at most `limit` (never more than 200). */
    async newest(
        connectionId: string,
        type: string,
        limit: number,
        manager?: EntityManager,
    ): Promise<Array<StoredRow>> {
        const def = this.types.declared(type)
        const rows = await this.rowsOf(def, connectionId, manager)
            .orderBy("r.occurred_at", "DESC")
            .addOrderBy("r.id", "DESC")
            .limit(readLimitOf(limit))
            .getMany()
        return rows.map((row) => storedRowOf(row))
    }

    /**
     * The newest row whose member equals the value; `field` must be the first member of a declared index of the type (else
     * INDEX_UNDECLARED), so the read always runs on that index. Null when there is none.
     */
    newestWhere(
        connectionId: string,
        type: string,
        field: string,
        equals: AccountMemberValue,
        manager?: EntityManager,
    ): Promise<OptionalStoredRow> {
        return this.newestRow(connectionId, type, field, equals, null, manager)
    }

    /**
     * The newest row whose member equals the value AND whose other member equals the second value (a row of one direction, a message of
     * one kind): the same index read as `newestWhere`, narrowed by a declared member of the type (a member the type does not declare is a wiring
     * fault: INDEX_UNDECLARED). Null when there is none.
     */
    newestWhereAlso(
        connectionId: string,
        type: string,
        field: string,
        equals: AccountMemberValue,
        also: AccountMemberFilter,
        manager?: EntityManager,
    ): Promise<OptionalStoredRow> {
        return this.newestRow(connectionId, type, field, equals, also, manager)
    }

    private async newestRow(
        connectionId: string,
        type: string,
        field: string,
        equals: AccountMemberValue,
        also: AccountMemberFilter | null,
        manager: EntityManager | undefined,
    ): Promise<OptionalStoredRow> {
        const def = this.types.declared(type)
        if (!(def.indexes ?? []).some((index) => index.on[0] === field)) {
            throw this.types.wiring(AccountDataErrorCode.IndexUndeclared, type, def.provider ?? "")
        }
        if (also !== null && def.fields[also.field] === undefined) {
            throw this.types.wiring(AccountDataErrorCode.IndexUndeclared, type, def.provider ?? "")
        }
        const query = this.rowsOf(def, connectionId, manager).andWhere(`${indexedMemberSql(def, field)} = :equals`, {
            equals: String(equals),
        })
        const narrowed =
            also === null
                ? query
                : query.andWhere(`${indexedMemberSql(def, also.field)} = :alsoEquals`, { alsoEquals: String(also.equals) })
        const row = await narrowed.orderBy("r.occurred_at", "DESC").addOrderBy("r.id", "DESC").limit(1).getOne()
        return row === null ? null : storedRowOf(row)
    }

    /** The rows of the type in the order they entered the store (created_at, id), after the point, at most `limit` (never more than 200). */
    async after(
        connectionId: string,
        type: string,
        point: OptionalEnteredPoint,
        limit: number,
    ): Promise<Array<EnteredRow>> {
        const def = this.types.declared(type)
        const query = this.selectedRows(this.rowsOf(def, connectionId))
            .orderBy("r.created_at", "ASC")
            .addOrderBy("r.id", "ASC")
            .limit(readLimitOf(limit))
        if (point !== null) {
            query.andWhere("(r.created_at, r.id) > (CAST(:afterAt AS timestamptz), CAST(:afterId AS uuid))", {
                afterAt: point.createdAt,
                afterId: point.id,
            })
        }
        const rows = await query.getRawMany<EnteredRaw>()
        return rows.map((row) => ({ ...row, value: valueOf(row.value) }))
    }

    /**
     * The row of the type with this id, whatever its connection (the caller proves the connection is its own), with its connection and
     * the fixed-width UTC moment it entered the store; null when there is none or it expired.
     */
    async byId(type: string, id: string, manager?: EntityManager): Promise<OptionalIdentifiedRow> {
        const def = this.types.declared(type)
        const query = this.selectedRows(
            this.withTtl(
                def,
                (manager ?? this.entityManager)
                    .createQueryBuilder(AccountDataEntity, "r")
                    .where("r.type = :type AND r.id = :id", { type: def.name, id }),
            ),
        ).addSelect("r.connection_id", "connectionId")
        const [row] = await query.limit(1).getRawMany<IdentifiedRaw>()
        return row === undefined ? null : { ...row, value: valueOf(row.value) }
    }

    /** What the account holds of each type: rows and the newest time, by type name, with each type's purpose tag. */
    async statsOf(connectionId: string): Promise<AccountDataStats> {
        const rows = await this.entityManager
            .createQueryBuilder(AccountDataEntity, "r")
            .select("r.type", "type")
            .addSelect("count(*)", "rows")
            .addSelect("max(r.occurred_at)", "newestAt")
            .where("r.connection_id = :connectionId", { connectionId })
            .groupBy("r.type")
            .getRawMany<StatsRaw>()
        return {
            types: rows
                .map((row) => ({
                    type: row.type,
                    purpose: this.types.of(row.type)?.purpose ?? null,
                    rows: Number(row.rows),
                    newestAt: row.newestAt,
                }))
                .sort((left, right) => byName(left.type, right.type)),
        }
    }

    /** The live rows of one type of the account: the partition, the connection, and the type's ttl on the database clock. */
    private rowsOf(
        def: AccountDataTypeDef,
        connectionId: string,
        manager?: EntityManager,
    ): SelectQueryBuilder<AccountDataEntity> {
        const query = (manager ?? this.entityManager)
            .createQueryBuilder(AccountDataEntity, "r")
            .where("r.type = :type AND r.connection_id = :connectionId", { type: def.name, connectionId })
        return this.withTtl(def, query)
    }

    /** The columns a raw read answers: the stored row and its fixed-width UTC `created_at`. */
    private selectedRows(query: SelectQueryBuilder<AccountDataEntity>): SelectQueryBuilder<AccountDataEntity> {
        return query
            .select("r.id", "id")
            .addSelect("r.type", "type")
            .addSelect("r.type_version", "typeVersion")
            .addSelect("r.key", "key")
            .addSelect("r.value", "value")
            .addSelect("r.occurred_at", "occurredAt")
            .addSelect("r.processed_at", "processedAt")
            .addSelect(CREATED_AT_UTC, "createdAt")
    }

    /** The query limited to rows younger than the type's ttl, on the database clock; as it is for a type without one. */
    private withTtl(
        def: AccountDataTypeDef,
        query: SelectQueryBuilder<AccountDataEntity>,
    ): SelectQueryBuilder<AccountDataEntity> {
        if (def.ttlMs === undefined) return query
        return query.andWhere("r.occurred_at > now() - make_interval(secs => CAST(:ttlSeconds AS double precision))", {
            ttlSeconds: def.ttlMs / 1000,
        })
    }
}
