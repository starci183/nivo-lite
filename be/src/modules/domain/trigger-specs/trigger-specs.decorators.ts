import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { TriggerSwitchReader } from "./trigger-specs.contracts"

/**
 * Token of the trigger switch reader readiness reads (`provider_trigger_switches`), bound by the capability that owns the switches
 * (`ProviderTriggerStoreService`, whose `listOf` has the reader's shape). With none bound, readiness judges a provider trigger by the
 * agent's attachment alone, exactly as it would with every switch on.
 */
export const TRIGGER_SWITCH_READER: unique symbol = Symbol("domain.trigger-specs.switch-reader")

/** Injects the trigger switch reader. Parameter type: TriggerSwitchReader. */
export const InjectTriggerSwitchReader = (): TypedParameterDecorator<TriggerSwitchReader> =>
    injector<TriggerSwitchReader>(TRIGGER_SWITCH_READER)
