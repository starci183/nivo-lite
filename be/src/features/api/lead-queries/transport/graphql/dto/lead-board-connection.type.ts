import { Field, ObjectType } from "@nestjs/graphql"
import { LeadBoardPageInfoType } from "./lead-board-page-info.type"
import { LeadBoardType } from "./lead-board.type"

@ObjectType()
/** A bounded page of leads and the continuation state of the board. */
export class LeadBoardConnectionType {
    /** The leads in stable newest-first order. */
    @Field(() => [LeadBoardType])
    nodes!: ReadonlyArray<LeadBoardType>

    /** The cursor of the last lead and whether another page exists. */
    @Field(() => LeadBoardPageInfoType)
    pageInfo!: LeadBoardPageInfoType
}
