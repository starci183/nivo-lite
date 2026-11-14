import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One declared field of a record type. */
export class RecordFieldType {
    /** The field's name. */
    @Field(() => String)
    name!: string

    /** Its kind. */
    @Field(() => String)
    kind!: string

    /** Whether it may be absent or null. */
    @Field(() => Boolean)
    nullable!: boolean

    /** An enum's allowed values, else null. */
    @Field(() => [String], { nullable: true })
    values!: Array<string> | null
}

@ObjectType()
/** One record type of an installed agent. */
export class RecordTypeType {
    /** The type's name (`<package>.<agent>.<domain>`). */
    @Field(() => String)
    name!: string

    /** Its declared fields. */
    @Field(() => [RecordFieldType])
    fields!: Array<RecordFieldType>
}

@ObjectType()
/** One declared read the workbench door serves. */
export class RecordReadType {
    /** The read's id (workbenchRead `name`). */
    @Field(() => String)
    id!: string

    /** The kind of data it yields. */
    @Field(() => String)
    dataKind!: string

    /** One record or a list. */
    @Field(() => String)
    shape!: string

    /** The member permission it needs. */
    @Field(() => String)
    permission!: string

    /** The JSON Schema of its variables, as JSON text. */
    @Field(() => String)
    variablesJson!: string
}

@ObjectType()
/** One declared action the workbench door serves. */
export class RecordActionType {
    /** The action's id (workbenchAction `name`). */
    @Field(() => String)
    id!: string

    /** The member permission it needs. */
    @Field(() => String)
    permission!: string

    /** The JSON Schema of its input as JSON text, or null when it takes none. */
    @Field(() => String, { nullable: true })
    inputJson!: string | null
}

@ObjectType()
/** One installed module (agent template) with its record types, reads and actions. */
export class RecordModuleType {
    /** The module key. */
    @Field(() => String)
    module!: string

    /** Its record types. */
    @Field(() => [RecordTypeType])
    types!: Array<RecordTypeType>

    /** Its reads. */
    @Field(() => [RecordReadType])
    reads!: Array<RecordReadType>

    /** Its actions. */
    @Field(() => [RecordActionType])
    actions!: Array<RecordActionType>
}
