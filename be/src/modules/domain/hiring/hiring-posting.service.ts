import type { CredentialPrincipal } from "@modules/domain/identity"
import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { HiringError, HiringErrorCode } from "./errors/hiring.error"
import type { PostingCredentialRequest } from "./hiring-posting.contracts"
import { HiringDataService } from "./hiring-data.service"

@Injectable()
/** Checks that an anonymous submission targets an open public posting. */
export class HiringPostingService {
    constructor(
        private readonly data: HiringDataService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Refuses unpublished, closed and expired postings before any submission effects. */
    async requireOpen(request: PostingCredentialRequest): Promise<CredentialPrincipal> {
        const ws = request.ws
        const slug = request.job
        if (typeof ws !== "string" || !ws || ws.length > 80 || typeof slug !== "string" || !slug || slug.length > 120)
            throw new HiringError({ code: HiringErrorCode.PublicNotFound })
        const settings = await this.data.settingsBySlug(ws)
        if (settings === undefined || settings.publicSlug !== ws)
            throw new HiringError({ code: HiringErrorCode.PublicNotFound })
        const job = await this.data.jobBySlug(settings.workspaceId, slug)
        if (
            job === undefined ||
            job.workspaceId !== settings.workspaceId ||
            job.slug !== slug ||
            job.status === "draft"
        )
            throw new HiringError({ code: HiringErrorCode.PublicNotFound })
        if (job.status !== "open" || !job.channels.includes("page"))
            throw new HiringError({ code: HiringErrorCode.JobNotOpen })
        if (job.closesAt !== null && !(Date.parse(job.closesAt) >= this.clock.now().getTime()))
            throw new HiringError({ code: HiringErrorCode.JobExpired })
        return { kind: "posting", subject: job.id, workspaceId: job.workspaceId }
    }
}
