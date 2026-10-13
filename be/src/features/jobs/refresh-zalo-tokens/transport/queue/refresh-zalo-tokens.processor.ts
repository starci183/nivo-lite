import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { ZALO_REFRESH_QUEUE } from "@modules/queues/zalo-refresh"
import { RenewTokensStep } from "../../steps/renew-tokens.step"

@Injectable()
/** The processor of the refresh-zalo-tokens job: every scheduler tick runs the one step. */
export class RefreshZaloTokensProcessor extends FencedProcessor {
    readonly queue = ZALO_REFRESH_QUEUE

    constructor(private readonly renew: RenewTokensStep) {
        super()
    }

    /** Renews the due tokens; a stale token throws the fenced-out error from the guarded write before the effect. */
    async process(job: ClaimedJob): Promise<void> {
        await this.renew.run(job)
    }
}
