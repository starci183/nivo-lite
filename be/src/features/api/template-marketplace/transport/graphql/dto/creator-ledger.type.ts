import { Field, Int, ObjectType } from "@nestjs/graphql"
import { LedgerLineType } from "./ledger-line.type"

@ObjectType()
/** The ledger of a creator. */
export class CreatorLedgerType {
    /** The lines, newest first. */
    @Field(() => [LedgerLineType])
    lines!: Array<LedgerLineType>

    /** What the creator is owed in all, VND. */
    @Field(() => Int)
    owedVnd!: number
}
