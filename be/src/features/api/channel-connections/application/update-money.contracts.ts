import type { WizardConnection } from "@modules/domain/channel-connections"

/** What the UpdateMoney operation takes. */
export interface UpdateMoneyRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connectionId of the path. */
    readonly connectionId: string
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
    /** The apiKey sent by the caller. */
    readonly apiKey?: string
}

/** What the UpdateMoney operation answers. */
export type UpdateMoneyResult = WizardConnection
