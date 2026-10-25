import type { InjectionToken } from "@nestjs/common"

/** The storage and account providers the app root supplies. */
export interface AvatarsOptions {
    /** Provider token of a SupabaseObjectsPort implementation. */
    readonly storage: InjectionToken
    /** Provider token of an AvatarAccounts implementation. */
    readonly accounts: InjectionToken
}
