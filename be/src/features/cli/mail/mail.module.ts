import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./mail.module-definition"
import { MailCli } from "./mail.cli"
import { OutboxMailCli } from "./subs/outbox.cli"

@Module({ providers: [MailCli, OutboxMailCli] })
/** The mail group: the development outbox reader; the mail integration is composed by the cli app. */
export class MailCliModule extends ConfigurableModuleClass {}
