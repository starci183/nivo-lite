import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One step of a run as the history shows it. */
export class RunStepType {
    /** What happened, in plain words. */
    @Field()
    label!: string

    /** `done`, `skipped`, `waiting` or `failed`. */
    @Field()
    status!: string

    /** The detail line under the label. */
    @Field(() => String, { nullable: true })
    detail?: string
}
