import { IsUUID, MaxLength } from "class-validator"
import { Field, ID, InputType } from "@nestjs/graphql"

@InputType()
/** A finding. */
export class DossierFindingRefInput {
    /** The finding. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    findingId!: string
}
