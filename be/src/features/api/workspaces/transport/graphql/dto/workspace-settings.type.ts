import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The workspace's own settings: what the console header draws and what every node plans its days in. */
export class WorkspaceSettingsType {
    /** The workspace name. */
    @Field()
    name!: string

    /** The IANA time zone in which the workspace's day, week and month begin. */
    @Field()
    timeZone!: string

    /** The public HTTPS address of the logo; null while the workspace has none. */
    @Field(() => String, { nullable: true })
    logoUrl!: string | null
}
