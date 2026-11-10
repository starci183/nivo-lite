import { Field, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Where one workflow sits on the Graph page. */
export class AgentGraphLayoutPositionType {
    /** The key of the workflow. */
    @Field(() => String)
    workflowKey!: string

    /** The horizontal position. */
    @Field(() => Float)
    x!: number

    /** The vertical position. */
    @Field(() => Float)
    y!: number
}

@ObjectType()
/** The saved layout of the Graph page of one installation. */
export class AgentGraphLayoutType {
    /** Where each workflow sits; workflows without a position are placed by the page. */
    @Field(() => [AgentGraphLayoutPositionType])
    positions!: ReadonlyArray<AgentGraphLayoutPositionType>
}
