import { Module, type DynamicModule } from "@nestjs/common"
import { CONTACT_CONVERSATION_STORE } from "./contact-conversation-store.port"
import { TypeormContactConversationStore } from "./contact-conversation-store.typeorm"
import { ContactConversationService } from "./contact-conversation.service"
import { CHANNEL_DELIVERY_STORE } from "./channel-delivery-store.port"
import { TypeormChannelDeliveryStore } from "./channel-delivery-store.typeorm"
import { ChannelDeliveriesService } from "./channel-deliveries.service"
import { CUSTOMER_LINE_STORE } from "./customer-line-store.port"
import { TypeormCustomerLineStore } from "./customer-line-store.typeorm"
import { CustomerMessagesService } from "./customer-messages.service"
import { CUSTOMER_ROUTE_STORE } from "./customer-route-store.port"
import { TypeormCustomerRouteStore } from "./customer-route-store.typeorm"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./customer-routes.module-definition"
import { CustomerRoutesService } from "./customer-routes.service"

@Module({})
/**
 * The routes of the customers (public.customer_routes: one opaque id per person and entrance, the id every engine `conversation_id`
 * column holds) and the conversation with each customer, both directions (public.customer_messages: what the person said, written once by
 * the engine's delivery; what any agent or person said to them, the send's ledger row). A leaf: it depends on the
 * primary connection and on the contacts' one redirect, and knows no conversation of any plugin.
 */
export class CustomerRoutesModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                TypeormCustomerRouteStore,
                { provide: CUSTOMER_ROUTE_STORE, useExisting: TypeormCustomerRouteStore },
                TypeormChannelDeliveryStore,
                { provide: CHANNEL_DELIVERY_STORE, useExisting: TypeormChannelDeliveryStore },
                CustomerRoutesService,
                ChannelDeliveriesService,
                TypeormCustomerLineStore,
                { provide: CUSTOMER_LINE_STORE, useExisting: TypeormCustomerLineStore },
                CustomerMessagesService,
                TypeormContactConversationStore,
                { provide: CONTACT_CONVERSATION_STORE, useExisting: TypeormContactConversationStore },
                ContactConversationService,
            ],
            exports: [
                CustomerRoutesService,
                ChannelDeliveriesService,
                CustomerMessagesService,
                ContactConversationService,
                CUSTOMER_ROUTE_STORE,
                CHANNEL_DELIVERY_STORE,
                CUSTOMER_LINE_STORE,
            ],
        }
    }
}
