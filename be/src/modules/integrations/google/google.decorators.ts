import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { GoogleClient } from "./google.client"
import type { GoogleOptions } from "./google.options"

/** Token of the options of the google integration, exported so a spec can provide it. */
export const GOOGLE_OPTIONS: unique symbol = Symbol("integrations.google.options")

/** Token of the google client. */
export const GOOGLE_CLIENT: unique symbol = Symbol("integrations.google.client")

/** Injects the options of the google integration. Parameter type: GoogleOptions. */
export const InjectGoogleOptions = (): TypedParameterDecorator<GoogleOptions> => injector<GoogleOptions>(GOOGLE_OPTIONS)

/** Injects the google client. Parameter type: GoogleClient. */
export const InjectGoogleClient = (): TypedParameterDecorator<GoogleClient> => injector<GoogleClient>(GOOGLE_CLIENT)
