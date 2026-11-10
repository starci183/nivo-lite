import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Saves the weekly working hours of an agent; an empty text removes them. */
export class SaveWorkingHoursInput {
    /** The installation. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    installationId!: string

    /**
     * The hours as the web keeps them: `{"v":1,"afterHours":bool,"days":[[["08:00","20:00"]],...]}`, seven days Monday first, in the
     * workspace's time zone; `afterHours` is the "answer after hours" choice.
     */
    @Field()
    @IsString()
    @MaxLength(4000)
    value!: string
}
