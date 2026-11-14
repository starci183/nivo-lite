import { Module } from "@nestjs/common"
import { ContactsApiModule } from "../../contacts.module"
import { ConfigurableModuleClass } from "./contacts-graphql.module-definition"
import { ContactsResolver } from "./contacts.resolver"

@Module({
    imports: [ContactsApiModule.register({})],
    providers: [ContactsResolver],
})
/** The GraphQL transport of the contacts feature. */
export class ContactsGraphqlModule extends ConfigurableModuleClass {}
