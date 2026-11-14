import { Injectable } from "@nestjs/common"
import {
    SEPAY_MANIFEST,
    SepayNativeService,
    type ToolJson,
    type NativeToolFamily,
    type NativeCaller,
    type ToolManifest,
} from "@modules/domain/tools"
import { NativeViewService } from "./native-view.service"

@Injectable()
/**
 * The bank moves of the workspace's SePay accounts (`nivo.tool.payment.credit.list`, `nivo.tool.payment.debit.list`) in the apps that
 * serve a workspace, for internal callers only: the caller's view is judged first, then the tools run as the gateway's own adapter runs
 * them, over the accounts' raw rows. It takes the place of that adapter (the same connector key, `sepay`). The status of the bank
 * connections is `nivo.tool.connection.status.get`.
 */
export class SepayRecordsNativeService implements NativeToolFamily {
    readonly manifest: ToolManifest = SEPAY_MANIFEST

    constructor(
        private readonly views: NativeViewService,
        private readonly sepay: SepayNativeService,
    ) {}

    /** Runs one tool of the bank moves, for an internal caller only. */
    async invoke(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        await this.views.internalOf(workspaceId, caller)
        return this.sepay.invoke(workspaceId, tool, args)
    }
}
