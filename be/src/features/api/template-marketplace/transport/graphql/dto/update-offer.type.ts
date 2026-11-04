import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { UpdateUnitType } from "./update-unit.type"

@ObjectType()
/** The offer of a newer version of a template to an installation. */
export class UpdateOfferType {
    /** The installation. */
    @Field(() => ID)
    installationId!: string

    /** The template key. */
    @Field(() => String)
    key!: string

    /** The version installed. */
    @Field(() => Int)
    installed!: number

    /** The newer version. */
    @Field(() => Int)
    offered!: number

    /** True when the buyer must read it first. */
    @Field(() => Boolean)
    breaking!: boolean

    /** What changed. */
    @Field(() => String)
    changelog!: string

    /** The branches and nodes that change. */
    @Field(() => [UpdateUnitType])
    units!: ReadonlyArray<UpdateUnitType>
}
