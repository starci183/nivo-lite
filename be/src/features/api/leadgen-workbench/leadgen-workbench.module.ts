import { Module } from "@nestjs/common"
import { ReadLeadGenWorkbenchHandler } from "./application/read-leadgen-workbench.handler"

@Module({ providers: [ReadLeadGenWorkbenchHandler] })
/** The application handler of the Lead Gen workbench API. */
export class LeadGenWorkbenchApiModule {}
