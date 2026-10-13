import { Field, ObjectType, Int } from "@nestjs/graphql"
import { SalesSourceConversionType } from "./sales-source-conversion.type"

@ObjectType()
/** Conversion of leads created in the reporting window. */
export class SalesConversionType {
    /** The window days. */
    @Field(() => Int)
    windowDays!: number

    /** The leads. */
    @Field(() => Int)
    leads!: number

    /** The won. */
    @Field(() => Int)
    won!: number

    /** The sources. */
    @Field(() => [SalesSourceConversionType])
    sources!: ReadonlyArray<SalesSourceConversionType>
}
