import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InstallationChangedEvent } from "@modules/events/api"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectEventBus } from "@modules/platform/event-bus"
import type { EventBus } from "@modules/platform/event-bus"

/** What changed: one installation, or the whole workspace when `installationId` is null. */
export interface InstallationChange {
    /** The workspace. */
    readonly workspaceId: string
    /** The installation that changed; null when the workspace's shared business knowledge changed. */
    readonly installationId: string | null
    /** Rebuild the OpenClaw copy even when the installation is not on OpenClaw yet. */
    readonly force: boolean
}

@Injectable()
/** Tells the event bus that an installation changed, so the OpenClaw copy of its agent follows (`installation_changed`). */
export class InstallationChangesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectEventBus() private readonly bus: EventBus,
    ) {}

    /** Publishes the change in the transaction of the write that made it, so a rolled-back change announces nothing. */
    async announce(change: InstallationChange, tx: EntityManager): Promise<void> {
        const event = InstallationChangedEvent.create(change)
        await this.bus.publish(event, tx, event.eventId)
    }

    /**
     * Publishes a change whose write already committed in a service of another capability (it hands out no manager): the event goes
     * in a transaction of its own and the sync reactor is retried until it holds.
     */
    announceNow(change: InstallationChange): Promise<void> {
        return this.entityManager.transaction((tx) => this.announce(change, tx))
    }
}
