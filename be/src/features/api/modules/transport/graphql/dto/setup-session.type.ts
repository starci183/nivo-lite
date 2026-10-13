import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { GraphqlJsonObject } from "@modules/platform/graphql"
import { SetupDraftType } from "./setup-draft.type"

@ObjectType()
/** One setup session of an installation: the draft and the evidence per gate. */
export class SetupSessionType {
    /** The session. */
    @Field(() => ID)
    id!: string

    /** The workspace. */
    @Field(() => ID)
    workspaceId!: string

    /** The installation. */
    @Field(() => ID)
    installationId!: string

    /** The revision, from 1. */
    @Field(() => Int)
    revision!: number

    /** `draft`, `applied` or `discarded`. */
    @Field()
    status!: string

    /** The draft. */
    @Field(() => SetupDraftType)
    draft!: SetupDraftType

    /** The evidence per gate key: status, evidence, who and when it was confirmed. */
    @Field(() => GraphqlJsonObject)
    gateEvidence!: object

    /** When it was opened, ISO 8601. */
    @Field()
    createdAt!: string
}
