import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of setSepayEnvironment. */
export class SetSepayEnvironmentInput {
    /** The connection. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string

    /** `test` or `live`. */
    @Field(() => String)
    @IsString()
    @IsIn(["test", "live"])
    environment!: "test" | "live"
}
