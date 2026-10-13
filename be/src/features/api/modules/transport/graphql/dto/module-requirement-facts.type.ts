import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What a workspace has, as far as the requirements of a module are concerned. */
export class ModuleRequirementFactsType {
    /** The connection providers that are connected. */
    @Field(() => [String])
    providers!: ReadonlyArray<string>

    /** How many active chat agents (chatbot, booking) the workspace has. */
    @Field(() => Int)
    chatAgents!: number

    /** How many active staff members the workspace has. */
    @Field(() => Int)
    staff!: number

    /** How many active members the workspace has. */
    @Field(() => Int)
    members!: number
}
