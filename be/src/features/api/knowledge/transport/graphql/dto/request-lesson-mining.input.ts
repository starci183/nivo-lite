import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The agent whose corrections are studied. */
export class RequestLessonMiningInput {
    /** The agent. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(64)
    module!: string
}
