import { Field, ObjectType } from "@nestjs/graphql"
import { GraphqlJsonObject } from "@modules/platform/graphql"

@ObjectType()
/** Sample data for previews of a message. */
export class PreviewSampleType {
    /** Sample values by variable name. */
    @Field(() => GraphqlJsonObject)
    variables!: object

    /** The neutral words that fill a blank variable, by variable name. */
    @Field(() => GraphqlJsonObject)
    neutral!: object
}
