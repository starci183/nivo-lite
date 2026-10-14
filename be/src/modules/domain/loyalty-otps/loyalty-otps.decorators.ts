import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { Secret } from "@modules/platform/config"

/** Token of the secret pepper mixed into the stored hash of every code. */
export const LOYALTY_OTP_PEPPER: unique symbol = Symbol("domain.loyalty-otps.pepper")

/** Injects the pepper of the code hashes. Parameter type: Secret. */
export const InjectOtpPepper = (): TypedParameterDecorator<Secret> => injector<Secret>(LOYALTY_OTP_PEPPER)
