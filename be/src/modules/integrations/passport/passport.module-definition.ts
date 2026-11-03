import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost, InjectionToken } from "@nestjs/common"
import type { PassportOptions } from "./passport.options"

/** The options a registration takes: the typed settings and the provider token of the app's sign-in decisions. */
export interface PassportRegistration extends PassportOptions {
    /** The provider token of the app's sign-in decisions (its password and Google checks). */
    readonly authenticator: InjectionToken
}

const built = new ConfigurableModuleBuilder<PassportRegistration>()
    .setClassMethodName("register")
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
type Host = ConfigurableModuleHost<PassportRegistration, "register", "create", { isGlobal: boolean }>

/** The configurable-module base of the passport integration; `isGlobal` is decided by the app root. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = built.ConfigurableModuleClass
/** The options of a synchronous registration, for the register signature. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = built.OPTIONS_TYPE
