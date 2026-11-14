import { Field, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, Matches, MaxLength } from "class-validator"

@InputType({ isAbstract: true })
/** The bounded arguments every file call of the workbench door carries: what it is for, and the declared file field of one record. */
export abstract class WorkbenchFileTargetInput {
    /** The id of the read or action the call is made for, `<module>.<name>`: its permission and entity ports grant the call. */
    @Field()
    @IsString()
    @MaxLength(120)
    @Matches(/^[a-z][a-z0-9-]*\.[a-z][a-zA-Z0-9.-]*$/u)
    via!: string

    /** The record type, as its package declares it (`<module>.<thing>`). */
    @Field()
    @IsString()
    @MaxLength(120)
    @Matches(/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*){1,3}$/u)
    type!: string

    /** The record id. */
    @Field()
    @IsUUID()
    @MaxLength(36)
    recordId!: string

    /** The declared `file` field. */
    @Field()
    @IsString()
    @MaxLength(64)
    @Matches(/^[a-z][a-zA-Z0-9]{0,63}$/u)
    field!: string
}
