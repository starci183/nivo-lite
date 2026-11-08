import { MAILER, createMailer, type Mailer, type MailOptions as MailTransportOptions } from "@starci/mail"
import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { MailOptions } from "./mail.options"
import type { MailOutboxService } from "./mail-outbox.service"
import type { MailRelayService } from "./mail-relay.service"

/** Token of the app's mail settings (the brand, the default language, the link lifetimes). */
export const MAIL_SETTINGS: unique symbol = Symbol("integrations.mail.settings")

/** Token of the relay for a workspace's own SMTP account and the platform sender. */
export const MAIL_RELAY: unique symbol = Symbol("integrations.mail.relay")

/** Token of the development outbox of held messages. */
export const MAIL_OUTBOX: unique symbol = Symbol("integrations.mail.outbox")

/** Token of the factory that builds one mailer for one workspace SMTP account, exported so a spec can provide a fake. */
export const MAILER_FACTORY: unique symbol = Symbol("integrations.mail.mailer-factory")

/** A mailer that holds a connection and closes it on demand. */
export interface ClosableMailer extends Mailer {
    /** Closes the connection of the mailer; the Nest module calls it at shutdown. */
    onModuleDestroy(): void
}

/** Builds mailers over the SMTP settings of an account. */
export interface MailerFactory {
    /** Builds one mailer over the SMTP settings of one account. */
    create(options: MailTransportOptions): ClosableMailer
}

/** The factory the module provides: `createMailer` of `@starci/mail`. */
export const packageMailerFactory: MailerFactory = { create: createMailer }

/** Injects the mail port of `@starci/mail`. Parameter type: Mailer. */
export const InjectMailer = (): TypedParameterDecorator<Mailer> => injector<Mailer>(MAILER)

/** Injects the app's mail settings. Parameter type: MailOptions. */
export const InjectMailSettings = (): TypedParameterDecorator<MailOptions> => injector<MailOptions>(MAIL_SETTINGS)

/** Injects the relay. Parameter type: MailRelayService. */
export const InjectMailRelay = (): TypedParameterDecorator<MailRelayService> => injector<MailRelayService>(MAIL_RELAY)

/** Injects the mailer factory. Parameter type: MailerFactory. */
export const InjectMailerFactory = (): TypedParameterDecorator<MailerFactory> => injector<MailerFactory>(MAILER_FACTORY)

/** Injects the development outbox. Parameter type: MailOutboxService. */
export const InjectMailOutbox = (): TypedParameterDecorator<MailOutboxService> =>
    injector<MailOutboxService>(MAIL_OUTBOX)
