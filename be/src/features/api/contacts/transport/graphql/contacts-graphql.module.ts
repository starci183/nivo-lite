import { Module } from "@nestjs/common"
import { ContactsApiModule } from "../../contacts.module"
import { ConfigurableModuleClass } from "./contacts-graphql.module-definition"
import { ContactDetailResolver } from "./contact-detail.resolver"
import { ContactsResolver } from "./contacts.resolver"

@Module({
    imports: [ContactsApiModule.register({})],
    providers: [ContactsResolver, ContactDetailResolver],
})
/** The GraphQL transport of the contacts feature. */
export class ContactsGraphqlModule extends ConfigurableModuleClass {}
