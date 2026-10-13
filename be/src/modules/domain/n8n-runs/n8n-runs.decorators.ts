import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { N8nMailer } from "./n8n-runs.contracts"

/** Token of the mail of the product, which sends the emails the workflows ask for. */
export const N8N_MAILER: unique symbol = Symbol("domain.n8n-runs.mailer")

/** Injects the mailer. Parameter type: N8nMailer. */
export const InjectN8nMailer = (): TypedParameterDecorator<N8nMailer> => injector<N8nMailer>(N8N_MAILER)
