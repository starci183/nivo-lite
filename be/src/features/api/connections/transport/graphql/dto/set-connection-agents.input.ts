import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, IsUUID, MaxLength, ValidateNested } from "class-validator"
import { GrantWishInput } from "./grant-wish.input"

@InputType()
/** The bounded arguments of setConnectionAgents. */
export class SetConnectionAgentsInput {
    /** The connection. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string

    /** The agents wanted. */
    @Field(() => [GrantWishInput])
    @IsArray()
    @ArrayMaxSize(200)
    @ValidateNested({ each: true })
    @Type(() => GrantWishInput)
    agents!: ReadonlyArray<GrantWishInput>
}
