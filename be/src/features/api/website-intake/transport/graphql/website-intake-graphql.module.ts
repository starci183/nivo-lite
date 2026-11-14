import { Module } from "@nestjs/common"
import { WebsiteIntakeApiModule } from "../../website-intake.module"
import { WebsiteIntakeResolver } from "./website-intake.resolver"
import { ConfigurableModuleClass } from "./website-intake-graphql.module-definition"

@Module({ imports: [WebsiteIntakeApiModule.register({})], providers: [WebsiteIntakeResolver] })
/** The GraphQL website intake: the owner's settings and the public form. */
export class WebsiteIntakeGraphqlModule extends ConfigurableModuleClass {}
