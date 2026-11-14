import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { MisaMeinvoiceClient } from "./misa-meinvoice.client"
import type { MisaMeinvoiceOptions } from "./misa-meinvoice.options"

/** Token of the MisaMeinvoice client. */
export const MISA_MEINVOICE: unique symbol = Symbol("integrations.misa-meinvoice")

/** Token of the options of the MisaMeinvoice integration, exported so a spec can provide it. */
export const MISA_MEINVOICE_OPTIONS: unique symbol = Symbol("integrations.misa-meinvoice.options")

/** Injects the options of the MisaMeinvoice integration. Parameter type: MisaMeinvoiceOptions. */
export const InjectMisaMeinvoiceOptions = (): TypedParameterDecorator<MisaMeinvoiceOptions> =>
    injector<MisaMeinvoiceOptions>(MISA_MEINVOICE_OPTIONS)

/** Injects the MisaMeinvoice client. Parameter type: MisaMeinvoiceClient. */
export const InjectMisaMeinvoice = (): TypedParameterDecorator<MisaMeinvoiceClient> => injector<MisaMeinvoiceClient>(MISA_MEINVOICE)
