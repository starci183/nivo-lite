import { Module } from "@nestjs/common"
import { LeadGenWorkbenchApiModule } from "../../leadgen-workbench.module"
import { ReadLeadGenWorkbenchResolver } from "./read-leadgen-workbench.resolver"

@Module({ imports: [LeadGenWorkbenchApiModule], providers: [ReadLeadGenWorkbenchResolver] })
/** The GraphQL transport of the Lead Gen workbench API. */
export class LeadGenWorkbenchGraphqlModule {}
