import type { EnvSource } from "@modules/platform/config"
import type { BillingOptions } from "./billing.options"

/** Reads the billing configuration; every key is optional because each door refuses its deliveries when its key is absent. */
export const parseBillingConfig = (env: EnvSource): BillingOptions => ({
    sepayApiKey: env.has("SEPAY_WEBHOOK_API_KEY") ? env.secret("SEPAY_WEBHOOK_API_KEY") : undefined,
    bankAccount: {
        account: env.optional("SEPAY_BANK_ACCOUNT") ?? "",
        bank: env.optional("SEPAY_BANK_CODE") ?? "",
        holder: env.optional("SEPAY_ACCOUNT_NAME") ?? "",
    },
})
