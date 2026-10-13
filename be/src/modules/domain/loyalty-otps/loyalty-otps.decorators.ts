import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"

/** Token of the secret pepper mixed into the stored hash of every code. */
export const LOYALTY_OTP_PEPPER: unique symbol = Symbol("domain.loyalty-otps.pepper")

/** Injects the pepper of the code hashes. Parameter type: string. */
export const InjectOtpPepper = (): TypedParameterDecorator<string> => injector<string>(LOYALTY_OTP_PEPPER)
