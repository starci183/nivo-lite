import type { WizardConnection } from "@modules/domain/channel-connections"

/** What the StartMoney operation takes. */
export interface StartMoneyRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The provider sent by the caller. */
    readonly provider: string
    /** The environment sent by the caller. */
    readonly environment: string
    /** The name sent by the caller. */
    readonly name: string
    /** The bankCode sent by the caller. */
    readonly bankCode: string
    /** The accountNumber sent by the caller. */
    readonly accountNumber: string
    /** The holder sent by the caller. */
    readonly holder: string
}

/** What the StartMoney operation answers. */
export type StartMoneyResult = WizardConnection
