import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One item of the base knowledge of NIVO. */
export class NivoEntryType {
    /** The item id. */
    @Field(() => ID)
    id!: string

    /** The module folder, or `core`. */
    @Field(() => String)
    module!: string

    /** The stable slug. */
    @Field(() => String)
    slug!: string

    /** The title. */
    @Field(() => String)
    title!: string

    /** The markdown body. */
    @Field(() => String)
    body!: string

    /** `playbook`, `authority`, `escalation`, `setup_checklist` or `tone`. */
    @Field(() => String)
    kind!: string

    /** The version of the text. */
    @Field(() => Int)
    version!: number

    /** When it last changed, ISO 8601. */
    @Field(() => String)
    updatedAt!: string
}
