import { Field, ObjectType } from "@nestjs/graphql"
import { AuthorityProfileType } from "./authority-profile.type"
import { AuthorityRuleType } from "./authority-rule.type"

@ObjectType()
/** What the Authority page reads: the sheet and every stored rule. */
export class AuthoritySheetType {
    /** The goals and house rules; null before the workspace has any. */
    @Field(() => AuthorityProfileType, { nullable: true })
    profile?: AuthorityProfileType | null

    /** Every stored rule. */
    @Field(() => [AuthorityRuleType])
    rules!: ReadonlyArray<AuthorityRuleType>
}
