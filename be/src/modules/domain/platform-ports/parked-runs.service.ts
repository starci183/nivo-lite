import { Injectable } from "@nestjs/common"
import type { ParkedRuns } from "@nivo-lite/agent-sdk/platform"
import type { Locale } from "@modules/platform/i18n"

/** Who asks and in which language. */
export interface ParkedRunsAsker {
    /** The workspace. */
    readonly workspaceId: string
    /** The seat that asks; null when none. */
    readonly memberId: string | null
    /** The viewer's language. */
    readonly locale: Locale
}

@Injectable()
/**
 * The `platform.parked-runs` port. The engine parks no run any more (a thread run that cannot go on stops and asks the founder through the
 * stop card), so the port answers an empty list, knows no run and resumes nothing. It stays so a screen that declares the port still runs;
 * the port and its kind go with the blocks-core declaration.
 */
export class ParkedRunsService {
    /** The port for one asker: nothing is parked. */
    portFor(_asker: ParkedRunsAsker): ParkedRuns {
        return {
            list: () => Promise.resolve({ total: 0, rows: [] }),
            find: () => Promise.resolve(null),
            resume: () => Promise.resolve(false),
        }
    }
}
