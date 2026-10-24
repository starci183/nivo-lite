import { Field, ObjectType } from "@nestjs/graphql"
import { WorkThreadPageInfoType } from "./work-thread-page-info.type"
import { WorkThreadListingType } from "./work-thread-listing.type"

@ObjectType()
/** A bounded page of work threads and the cursor to continue it. */
export class WorkThreadConnectionType {
    /** The work threads in stable creation order. */
    @Field(() => [WorkThreadListingType])
    nodes!: ReadonlyArray<WorkThreadListingType>

    /** Whether another page follows and where it starts. */
    @Field(() => WorkThreadPageInfoType)
    pageInfo!: WorkThreadPageInfoType
}
