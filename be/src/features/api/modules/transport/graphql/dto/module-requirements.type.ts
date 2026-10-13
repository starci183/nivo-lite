import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What a workspace must have for the module to work well. */
export class ModuleRequirementsType {
    /** The capability names the workspace should provide. */
    @Field(() => [String])
    capabilities!: ReadonlyArray<string>

    /** The connection providers the workspace should have connected. */
    @Field(() => [String])
    connections!: ReadonlyArray<string>
}
