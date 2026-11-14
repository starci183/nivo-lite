import { Module, type DynamicModule, type OnModuleInit } from "@nestjs/common"
import { triggerDeclarations } from "@modules/domain/provider-triggers"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./website-intake.module-definition"
import { WebsiteLeadWakeService } from "./website-lead-wake.service"
import { WebsiteOwnerService } from "./website-owner.service"
import { WebsiteSitesService } from "./website-sites.service"
import { WEBSITE_FORM_TRIGGER } from "./website-form.trigger"

@Module({})
/**
 * The website that brings customers in: the owner's switches and agent, the hosted form a visitor fills in under the site key, and the
 * wake of the owning agent (`website.message.received`). Each accepted form stores one input and meets one core contact; no agent record.
 */
export class WebsiteIntakeModule extends ConfigurableModuleClass implements OnModuleInit {
    /** Registers the capability in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const services = [WebsiteLeadWakeService, WebsiteOwnerService, WebsiteSitesService]
        return { ...base, providers: [...(base.providers ?? []), ...services], exports: services }
    }

    /** Registers the website form's trigger once. */
    onModuleInit(): void {
        triggerDeclarations.register(WEBSITE_FORM_TRIGGER)
    }
}
