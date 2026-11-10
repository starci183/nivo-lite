import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { InboxLeadsEventsService } from "./inbox-leads-events.service"
import { InboxLeadsRecordsService } from "./inbox-leads-records.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./inbox-leads.module-definition"
import { InboxLeadsService } from "./inbox-leads.service"
import { WebsiteLeadWakeService } from "./website-lead-wake.service"
import { WebsiteSitesService } from "./website-sites.service"

@Module({})
/**
 * The inbox as a list of customers, and the website that brings customers in. It reads the sales records through the entity engine and the
 * inputs, the work and the decisions through its own reads; the website intake writes one input and one customer per submitted form.
 */
export class InboxLeadsModule extends ConfigurableModuleClass {
    /** Registers the capability in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const services = [
            InboxLeadsService,
            InboxLeadsRecordsService,
            InboxLeadsEventsService,
            WebsiteLeadWakeService,
            WebsiteSitesService,
        ]
        return { ...base, providers: [...(base.providers ?? []), ...services], exports: services }
    }
}
