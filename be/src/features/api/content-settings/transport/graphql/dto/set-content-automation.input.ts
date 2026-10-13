import { Field, InputType } from "@nestjs/graphql"
import { IsBoolean, IsIn } from "class-validator"
import type { ContentAutomationKey } from "@modules/domain/content-settings"

@InputType()
/** Switches exactly one existing content automation. */
export class SetContentAutomationInput {
    /** The automation key. */
    @Field(() => String)
    @IsIn(["today_reminder", "offer_draft", "weekly_summary"])
    key!: ContentAutomationKey

    /** Whether it is switched on. */
    @Field()
    @IsBoolean()
    on!: boolean
}
