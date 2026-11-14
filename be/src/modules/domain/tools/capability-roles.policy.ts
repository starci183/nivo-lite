import { EINVOICE_MANIFEST } from "./adapters/einvoice-native.service"
import { SEPAY_MANIFEST } from "./adapters/sepay-native.service"
import type { CapabilityRole, RoleReadiness, ToolManifest } from "./tool-manifest.contracts"

/**
 * The tool families that play a capability role: the gateway's own SePay and e-invoice families, the only manifests that declare one
 * (a guard in the native names' spec keeps every role-playing family of the api app in this list). A role is code, the same in every
 * workspace and every app, so whether a module's required roles are played is read here, with no tool registry in the process.
 */
export const ROLE_FAMILY_MANIFESTS: ReadonlyArray<ToolManifest> = [SEPAY_MANIFEST, EINVOICE_MANIFEST]

/** The display names of the families that declare a role. */
const providersOf = (role: CapabilityRole): ReadonlyArray<string> => [
    ...new Set(
        ROLE_FAMILY_MANIFESTS.filter((manifest) => manifest.tools.some((spec) => spec.role === role)).map(
            (manifest) => manifest.name,
        ),
    ),
]

/**
 * Whether the code plays the roles a module requires (each has a family declaring it), the roles none plays, and for every role of the
 * vocabulary the display names of the families that declare it, so a card can say what to connect. Pure.
 */
export const roleReadinessOf = (roles: ReadonlyArray<CapabilityRole>): RoleReadiness => {
    const missing = roles.filter((role) => providersOf(role).length === 0)
    return {
        ready: missing.length === 0,
        missing,
        providers: {
            "identity.find": providersOf("identity.find"),
            "identity.upsert": providersOf("identity.upsert"),
            "receivable.find": providersOf("receivable.find"),
            "receivable.recordPayment": providersOf("receivable.recordPayment"),
            "payment.credits.list": providersOf("payment.credits.list"),
            "payment.debits.list": providersOf("payment.debits.list"),
            "invoice.list": providersOf("invoice.list"),
        },
    }
}
