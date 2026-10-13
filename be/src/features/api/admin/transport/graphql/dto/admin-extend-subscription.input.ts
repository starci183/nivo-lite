import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsUUID, Max, MaxLength, Min } from "class-validator"

@InputType()
/** The bounded arguments that extend a subscription. */
export class AdminExtendSubscriptionInput {
    /** The workspace. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    workspaceId!: string

    /** Whole days to add, 1 to 366. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    @Max(366)
    days!: number
}
