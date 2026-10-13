import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { DataJsonScalar } from "./data-json.type"

@ObjectType()
/** A saved database target, without the password. */
export class SavedDatabaseTargetType {
    /** The engine: postgres, mysql or mssql. */
    @Field(() => String)
    engine!: string

    /** The server host. */
    @Field(() => String)
    host!: string

    /** The server port. */
    @Field(() => Int)
    port!: number

    /** The database name. */
    @Field(() => String)
    database!: string

    /** The user. */
    @Field(() => String)
    user!: string

    /** True for an encrypted connection. */
    @Field(() => Boolean)
    ssl!: boolean
}

@ObjectType()
/** A saved database connection as the wizard reopens it. */
export class SavedDatabaseType {
    /** The connection name. */
    @Field(() => String)
    name!: string

    /** How it reaches the database, without the password. */
    @Field(() => SavedDatabaseTargetType)
    target!: SavedDatabaseTargetType

    /** True when a password is stored. */
    @Field(() => Boolean)
    hasPassword!: boolean

    /** The mapped tables: a list of {schema, table, entity, idColumn, titleColumn, updatedColumn, columns}. */
    @Field(() => DataJsonScalar)
    tables!: unknown

    /** Minutes between scheduled syncs; null is manual only. */
    @Field(() => Int, { nullable: true })
    everyMinutes!: number | null

    /** The agents that hold a grant on the connection. */
    @Field(() => [ID])
    agentIds!: Array<string>
}
