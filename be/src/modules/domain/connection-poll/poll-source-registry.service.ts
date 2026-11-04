import { Injectable } from "@nestjs/common"
import type { OptionalPollSource, PollSourceDirectory } from "./poll-schedule.contracts"

@Injectable()
/**
 * The scheduled sources of every capability, found by provider key. A capability that can be polled (bank feeds, message inboxes) adds a directory of
 * its registered providers once the app has booted; the scheduler asks here and never names a provider or a capability.
 */
export class PollSourceRegistryService {
    private readonly directories: Array<PollSourceDirectory> = []

    /** Adds the directory of one capability. */
    add(directory: PollSourceDirectory): void {
        this.directories.push(directory)
    }

    /** Every provider key that can be polled. */
    providers(): ReadonlyArray<string> {
        return [...new Set(this.directories.flatMap((directory) => directory.providers()))]
    }

    /** The source of a provider, or undefined when none of the capabilities has it. */
    sourceOf(provider: string): OptionalPollSource {
        return this.directories.map((directory) => directory.sourceOf(provider)).find((source) => source !== undefined)
    }
}
