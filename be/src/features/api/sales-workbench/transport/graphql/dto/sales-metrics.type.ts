import { Field, ObjectType, Int, Float } from "@nestjs/graphql"
import { SalesConversionType } from "./sales-conversion.type"

@ObjectType()
/** The Sales header figures and conversion by source. */
export class SalesMetricsType {
    /** The open count. */
    @Field(() => Int)
    openCount!: number

    /** The proposal value vnd. */
    @Field(() => Float)
    proposalValueVnd!: number

    /** The proposal count. */
    @Field(() => Int)
    proposalCount!: number

    /** The won count. */
    @Field(() => Int)
    wonCount!: number

    /** The won value vnd. */
    @Field(() => Float)
    wonValueVnd!: number

    /** The waiting count. */
    @Field(() => Int)
    waitingCount!: number

    /** The conversion. */
    @Field(() => SalesConversionType)
    conversion!: SalesConversionType
}
