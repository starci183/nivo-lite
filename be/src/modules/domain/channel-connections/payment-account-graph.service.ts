import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { NodeQuery } from "@nivo-lite/agent-sdk/node"
import { GraphNodeRegistryService, rowsAnswering } from "@modules/domain/graph-nodes"
import type { NodeRow, NodeTurn } from "@modules/domain/graph-nodes"
import { bankDisplayNameOf } from "./bank-name.policy"
import { WorkspacePaymentAccountService } from "./workspace-payment-account.service"

@Injectable()
/**
 * The account the workspace is paid into as graph nodes see it: the `payment-account` data port, over the workspace's own bank feed.
 * The account belongs to the workspace and is linked to no turn, so both scopes answer the turn workspace's account and no other's.
 */
export class PaymentAccountGraphService implements OnModuleInit {
    constructor(
        private readonly accounts: WorkspacePaymentAccountService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
    ) {}

    /** Registers the port when the app hosts graph nodes; otherwise there is nothing to serve. */
    onModuleInit(): void {
        this.registry?.addDataPort({ kind: "payment-account", read: (turn, query) => this.read(turn, query) })
    }

    private async read(turn: NodeTurn, query: NodeQuery): Promise<ReadonlyArray<NodeRow>> {
        const account = await this.accounts.accountOf(turn.workspaceId)
        if (account === null) return []
        return rowsAnswering(
            [
                {
                    provider: account.provider,
                    bankCode: account.bankCode,
                    bankName: bankDisplayNameOf(account.bankCode),
                    accountNumber: account.accountNumber,
                    accountHolder: account.holder ?? "",
                    connectionId: account.connectionId,
                },
            ],
            query,
        )
    }
}
