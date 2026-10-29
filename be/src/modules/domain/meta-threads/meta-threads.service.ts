import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { OptionalLastMessageAt, ThreadPerson, ThreadTouch } from "./meta-threads.contracts"
import { MetaThreadEntity } from "./persistence/entities"

/** The window only ever moves forward: a late or replayed message never shortens it. */
const ONLY_FORWARD = "meta_threads.last_user_at < EXCLUDED.last_user_at"

@Injectable()
/** Owns the messaging windows: the one writer of meta_threads. */
export class MetaThreadsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Opens or moves forward the window of the person, inside the caller's transaction when one is handed in. */
    async touch(thread: ThreadTouch, manager: EntityManager = this.entityManager): Promise<void> {
        await manager
            .createQueryBuilder(MetaThreadEntity, "mt")
            .insert()
            .values({
                connectionId: thread.connectionId,
                platform: thread.platform,
                userId: thread.userId,
                lastUserAt: new Date(thread.at),
            })
            .orUpdate(["last_user_at"], ["connection_id", "platform", "user_id"], {
                overwriteCondition: { where: ONLY_FORWARD },
            })
            .execute()
    }

    /** When the person last wrote to the Page on the platform (ms since the epoch), or null when they never did. */
    async lastUserAt(person: ThreadPerson): Promise<OptionalLastMessageAt> {
        const thread = await this.entityManager.findOne(MetaThreadEntity, {
            select: { lastUserAt: true },
            where: { connectionId: person.connectionId, platform: person.platform, userId: person.userId },
        })
        if (thread === null) return null
        const last: Date | string = thread.lastUserAt
        return last instanceof Date ? last.getTime() : Date.parse(last)
    }
}
