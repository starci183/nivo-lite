import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One column of a table of the owner's database. */
export class DatabaseColumnType {
    /** The column name. */
    @Field(() => String)
    name!: string

    /** The engine's data type name. */
    @Field(() => String)
    type!: string
}

@ObjectType()
/** One table or view the database user can see. */
export class DatabaseTableType {
    /** The schema. */
    @Field(() => String)
    schema!: string

    /** The table name. */
    @Field(() => String)
    name!: string

    /** Its columns. */
    @Field(() => [DatabaseColumnType])
    columns!: Array<DatabaseColumnType>
}
