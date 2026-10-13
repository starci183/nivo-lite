import { Injectable } from "@nestjs/common"
import { InjectHiringOptions } from "./hiring.decorators"
import type { HiringOptions } from "./hiring.options"

/** The origin links use until the app root passes the real one. */
const DEFAULT_SITE = "https://nivo.vn"

@Injectable()
/** The public links the hiring capability gives out: a job page, the page where a candidate picks an interview time, the page where a candidate answers an offer. */
export class HiringLinksService {
    constructor(@InjectHiringOptions() private readonly options: HiringOptions) {}

    /** The origin links are built with. */
    siteOrigin(): string {
        return this.options.siteUrl ?? DEFAULT_SITE
    }

    private origin(): string {
        return this.siteOrigin()
    }

    /** The page of a job. */
    job(publicSlug: string, jobSlug: string): string {
        return `${this.origin()}/j/${publicSlug}/${jobSlug}`
    }

    /** The page where a candidate picks an interview time. */
    interview(token: string): string {
        return `${this.origin()}/j/lich/${token}`
    }

    /** The page where a candidate answers an offer. */
    offer(token: string): string {
        return `${this.origin()}/j/thu/${token}`
    }
}
