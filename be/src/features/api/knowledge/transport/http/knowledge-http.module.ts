import { Module } from "@nestjs/common"
import { KnowledgeApiModule } from "../../knowledge.module"
import { KnowledgeController } from "./knowledge.controller"

@Module({ imports: [KnowledgeApiModule], controllers: [KnowledgeController] })
/** The HTTP transport of the knowledge feature. */
export class KnowledgeHttpModule {}
