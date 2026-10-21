import { Injectable } from "@nestjs/common"
import { ContentSettingsService } from "@modules/domain/content-settings"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import type { MarketingTickDone, MarketingTickRequest } from "./content-agent.contracts"
import { ContentAgentLogEvent } from "./content-agent.log-events"
import { ContentScheduleService } from "./content-schedule.service"
import { MarketingInsightsService } from "./marketing-insights.service"

/** How many workspaces one page of the scan reads. */
const PAGE = 100
/** The keyset start of the workspace scan. */
const FIRST = "00000000-0000-0000-0000-000000000000"

@Injectable()
/**
 * The AI Marketing part of the quarter-hour content tick: the Zalo OA articles whose moment has come are published, then every
 * workspace with content settings gets its weekly report card when it is due. One workspace failing does not stop the others, and
 * each effect keeps its own mark (the post's channel record, the week's posting claim), so a repeated tick changes nothing twice.
 */
export class MarketingTickService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly settings: ContentSettingsService,
        private readonly schedule: ContentScheduleService,
        private readonly insights: MarketingInsightsService,
    ) {}

    /** Runs the tick for every workspace, or the one the request names; answers how many articles and reports it posted. */
    async run(request: MarketingTickRequest): Promise<MarketingTickDone> {
        const published = await this.schedule.publishDue().catch((cause: unknown) => {
            this.logger.error(ContentAgentLogEvent.TickFailed, cause, { step: "publish" })
            return 0
        })
        const reports = await this.reportsFrom(FIRST, request.workspaceId)
        return { published, reports }
    }

    /** One page of the keyset scan of the workspaces, then the pages after it; answers how many reports were posted. */
    private async reportsFrom(after: string, only: string | undefined): Promise<number> {
        const page = await this.settings.tickWorkspaces(after, PAGE, only)
        const posted: Array<boolean> = []
        await eachInOrder(page, async (workspace) => {
            posted.push(
                await this.insights.postWeeklyDue(workspace.workspaceId).catch((cause: unknown) => {
                    this.logger.error(ContentAgentLogEvent.TickFailed, cause, { workspaceId: workspace.workspaceId })
                    return false
                }),
            )
        })
        const count = posted.filter(Boolean).length
        const last = page.at(-1)
        if (last === undefined || page.length < PAGE) return count
        return count + (await this.reportsFrom(last.workspaceId, only))
    }
}
