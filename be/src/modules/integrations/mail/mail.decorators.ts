import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { MailClient } from "./mail.client"
import type { MailOptions } from "./mail.options"

/** Token of the mail client. */
export const MAIL: unique symbol = Symbol("integrations.mail")

/** Token of the options of the mail integration, exported so a spec can provide it. */
export const MAIL_OPTIONS: unique symbol = Symbol("integrations.mail.options")

/** Injects the options of the mail integration. Parameter type: MailOptions. */
export const InjectMailOptions = (): TypedParameterDecorator<MailOptions> => injector<MailOptions>(MAIL_OPTIONS)

/** Injects the mail client. Parameter type: MailClient. */
export const InjectMail = (): TypedParameterDecorator<MailClient> => injector<MailClient>(MAIL)
