import { Field, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { ValidateNested } from "class-validator"
import { AuthorityRuleChangeInput } from "./authority-rule-change.input"

@InputType()
/** Saves the rule of one action. */
export class SaveAuthorityRuleInput {
    /** The rule to save. */
    @Field(() => AuthorityRuleChangeInput)
    @ValidateNested()
    @Type(() => AuthorityRuleChangeInput)
    change!: AuthorityRuleChangeInput
}
