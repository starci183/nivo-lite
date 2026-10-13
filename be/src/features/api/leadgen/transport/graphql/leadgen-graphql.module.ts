import { Module } from "@nestjs/common"
import { LeadGenApiModule } from "../../leadgen.module"
import { ApproveLeadGenCommentResolver } from "./approve-leadgen-comment.resolver"
import { ReadLeadGenCommentStatusResolver } from "./read-leadgen-comment-status.resolver"
import { ReadLeadGenWorkbenchResolver } from "./read-leadgen-workbench.resolver"

@Module({
    imports: [LeadGenApiModule],
    providers: [ReadLeadGenWorkbenchResolver, ApproveLeadGenCommentResolver, ReadLeadGenCommentStatusResolver],
})
/** Composes the GraphQL doors of the Lead Gen workbench. */
export class LeadGenGraphqlModule {}
