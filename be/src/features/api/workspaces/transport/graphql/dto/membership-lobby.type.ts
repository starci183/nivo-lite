import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What the workspaces lobby shows of one workspace: its plan, its people and when the caller last opened it. */
export class MembershipLobbyType {
    /** The plan code, or null before the first payment. */
    @Field(() => String, { nullable: true })
    planCode!: string | null

    /** The Vietnamese plan name, or null when there is no plan. */
    @Field(() => String, { nullable: true })
    planNameVi!: string | null

    /** The English plan name, or null when there is no plan. */
    @Field(() => String, { nullable: true })
    planNameEn!: string | null

    /** The active members. */
    @Field(() => Int)
    memberCount!: number

    /** The active owners: one means the only owner cannot leave. */
    @Field(() => Int)
    ownerCount!: number

    /** The seats the workspace may fill (the paid seats, else the plan's), or null when there is no plan. */
    @Field(() => Int, { nullable: true })
    seatLimit!: number | null

    /** When the caller last opened the workspace, ISO 8601; null until the first open. */
    @Field(() => String, { nullable: true })
    lastOpenedAt!: string | null

    /** When its owner deleted it, ISO 8601; null while it lives. Only its owners see a deleted workspace. */
    @Field(() => String, { nullable: true })
    deletedAt!: string | null

    /** Until when its owner may restore it, ISO 8601; null while it lives. */
    @Field(() => String, { nullable: true })
    restoreBefore!: string | null

    /** When a person switched the caller's seat off, ISO 8601; null while it is on. */
    @Field(() => String, { nullable: true })
    disabledAt!: string | null

    /** The name of who switched the caller's seat off, when known. */
    @Field(() => String, { nullable: true })
    disabledByName!: string | null

    /** The role of who switched the caller's seat off, when known. */
    @Field(() => String, { nullable: true })
    disabledByRole!: string | null

    /** The note left when the caller's seat was switched off. */
    @Field(() => String, { nullable: true })
    disabledNote!: string | null
}
