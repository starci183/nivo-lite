import { Module } from "@nestjs/common"
import { GetWebsiteThemeHandler } from "./application/get-website-theme.handler"
import { GetWebsiteSiteHandler } from "./application/get-website-site.handler"
import { SaveWebsiteSiteHandler } from "./application/save-website-site.handler"
import { SubmitWebsiteLeadHandler } from "./application/submit-website-lead.handler"
import { ConfigurableModuleClass } from "./website-intake.module-definition"

@Module({ providers: [GetWebsiteThemeHandler, GetWebsiteSiteHandler, SaveWebsiteSiteHandler, SubmitWebsiteLeadHandler] })
/** The website intake application queries and commands: the owner's settings and the form a visitor submits. */
export class WebsiteIntakeApiModule extends ConfigurableModuleClass {}
