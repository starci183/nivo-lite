import { IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator"
import { Field, ID, InputType } from "@nestjs/graphql"

@InputType()
/** Who owns a finding and by when. */
export class AssignDossierFindingInput {
    /** The finding. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    findingId!: string

    /** The member; none leaves it unassigned. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    assigneeId: string | null = null

    /** The due date as YYYY-MM-DD. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    @MaxLength(10)
    dueAt: string | null = null
}
