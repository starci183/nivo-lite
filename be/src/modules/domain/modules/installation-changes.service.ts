import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InstallationChangedEvent, whenPresent } from "@modules/events/api"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectEventBus } from "@modules/platform/event-bus"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import type { EventBus } from "@modules/platform/event-bus"

/** What changed: one installation, or the whole workspace when `installationId` is null. */
export interface InstallationChange {
    /** The workspace. */
    readonly workspaceId: string
    /** The installation that changed; null when the workspace's shared business knowledge changed. */
    readonly installationId: string | null
    /** True on an install: the event's version-1 `force` member (no consumer reads it since the agent copy sync went). */
    readonly force: boolean
}

@Injectable()
/** Tells the event bus that an installation changed (`installation_changed`), so its consumers (the agent wakes) follow. */
export class InstallationChangesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectEventBus() private readonly bus: EventBus,
        @InjectIds() private readonly ids: Ids,
    ) {}

    /** Publishes the change in the transaction of the write that made it, so a rolled-back change announces nothing. */
    async announce(change: InstallationChange, tx: EntityManager): Promise<void> {
        const event = InstallationChangedEvent.create(
            {
                workspaceId: change.workspaceId,
                ...whenPresent("installationId", change.installationId),
                force: change.force,
            },
            this.ids.next(),
        )
        await this.bus.publish(event, tx, event.eventId)
    }

    /**
     * Publishes a change whose write already committed in a service of another capability (it hands out no manager): the event goes
     * in a transaction of its own and each consumer is retried until it holds.
     */
    announceNow(change: InstallationChange): Promise<void> {
        return this.entityManager.transaction((tx) => this.announce(change, tx))
    }
}
