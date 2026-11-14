import { Injectable, Optional } from "@nestjs/common"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { ToolsError, ToolsErrorCode } from "@modules/domain/tools"
import { AccountDataReadService } from "@modules/domain/account-data"
import {
    type OptionalProviderInfo,
    type ProviderInfoFigure,
    type InterfaceProviderAnswer,
    type InterfaceProviderRead,
    type InterfaceReadProvider,
} from "@modules/domain/workbench-door"
import { accountInfoOf, bankFiguresOf, mailboxFiguresOf, type AccountRecord } from "./account-info.policy"

/** The figures a provider draws from one of its accounts. */
type FiguresOf = (workspaceId: string, record: AccountRecord) => Promise<ReadonlyArray<ProviderInfoFigure>>

/** The raw type of a SePay account's bank movements. */
const SEPAY_TRANSACTION = "sepay.transaction"

/**
 * The workbench face of a provider that offers only its accounts' current state so far (no named read): `infoOf` reads the
 * workspace's own connection of that provider and draws the provider's figures from what NIVO already stores; nothing is fetched
 * from outside, so its freshness is `synced`. A connection of another workspace or another provider is no account of it.
 */
class AccountInfoProvider implements InterfaceReadProvider {
    /** Its answers come from NIVO's own store. */
    readonly freshness = "synced" as const

    constructor(
        readonly provider: string,
        private readonly bindings: ConnectionBindingsReadService,
        private readonly figuresOf: FiguresOf,
    ) {}

    /** No named read yet. */
    readsOf(): Promise<ReadonlyArray<InterfaceProviderRead>> {
        return Promise.resolve([])
    }

    /** No named read yet: every name is refused. */
    read(): Promise<InterfaceProviderAnswer> {
        return Promise.reject(new ToolsError({ code: ToolsErrorCode.NativeRefused, params: { reason: "not_selected" } }))
    }

    /** The current state of one account of the workspace, or null when it has no such account of this provider. */
    async infoOf(workspaceId: string, connectionId: string): Promise<OptionalProviderInfo> {
        const record = await this.bindings.recordOf(workspaceId, connectionId)
        if (record?.provider !== this.provider) return null
        return accountInfoOf(record, await this.figuresOf(workspaceId, record))
    }
}

@Injectable()
/** The providers whose workbench face is their accounts' info: the bank feed (SePay) and the mailbox (IMAP). */
export class AccountInfoService {
    constructor(
        private readonly bindings: ConnectionBindingsReadService,
        @Optional() private readonly accountData?: AccountDataReadService,
    ) {}

    /** One workbench provider per such provider, for the door's registry. */
    providers(): ReadonlyArray<InterfaceReadProvider> {
        return [
            new AccountInfoProvider("sepay", this.bindings, async (_workspaceId, record) =>
                bankFiguresOf(record, await this.receivedOf(record.id)),
            ),
            new AccountInfoProvider("imap", this.bindings, (_workspaceId, record) => Promise.resolve(mailboxFiguresOf(record))),
        ]
    }

    /**
     * How many raw `sepay.transaction` rows the account holds, through the account data read; null where that read is not registered or
     * fails: the account card then draws a dash, never a wrong number.
     */
    private async receivedOf(connectionId: string): Promise<number | null> {
        if (this.accountData === undefined) return null
        try {
            const stats = await this.accountData.statsOf(connectionId)
            return stats.types.find((row) => row.type === SEPAY_TRANSACTION)?.rows ?? 0
        } catch {
            return null
        }
    }
}
