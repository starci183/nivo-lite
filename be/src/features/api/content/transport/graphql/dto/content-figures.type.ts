import { Field, ObjectType, Int } from "@nestjs/graphql"
import { ContentNextPostType } from "./content-next-post.type"
import { ContentPillarCoverageType } from "./content-pillar-coverage.type"

@ObjectType()
/** The content dashboard counts. */
export class ContentFiguresType {
    /** The number of posts waiting for approval. */
    @Field(() => Int)
    awaitingApproval!: number

    /** The number of posts published in the past thirty days. */
    @Field(() => Int)
    published30!: number

    /** The next approved scheduled post, when there is one. */
    @Field(() => ContentNextPostType, { nullable: true })
    next!: ContentNextPostType | null

    /** Coverage of active themes this month. */
    @Field(() => ContentPillarCoverageType)
    pillars!: ContentPillarCoverageType
}
