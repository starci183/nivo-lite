import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What a sync of the first-party templates did. */
export class FirstPartySyncReportType {
    /** The keys that got a new version. */
    @Field(() => [String])
    packaged!: Array<string>

    /** The keys whose latest version already says what the module seed says. */
    @Field(() => [String])
    unchanged!: Array<string>

    /** The keys the packager refused. */
    @Field(() => [String])
    refused!: Array<string>

    /** How many installations were recorded as installs of their first-party package. */
    @Field(() => Int)
    adopted!: number
}
