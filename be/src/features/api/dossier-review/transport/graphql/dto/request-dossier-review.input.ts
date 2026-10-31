import { Field, ID, InputType } from "@nestjs/graphql"
import { IsOptional, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Which dossier to review; none means the whole set. */
export class RequestDossierReviewInput {
    /** The dossier, or null for the whole set. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    dossierId: string | null = null
}
