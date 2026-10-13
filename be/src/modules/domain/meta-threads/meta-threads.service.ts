import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { OptionalLastMessageAt, ThreadPerson, ThreadTouch } from "./meta-threads.contracts"
import type { MetaThreadRow } from "./persistence/meta-threads.rows"
import { FIND_META_THREAD, TOUCH_META_THREAD } from "./persistence/meta-threads.sql"

@Injectable()
/** Owns the messaging windows: the one writer of meta_threads. */
export class MetaThreadsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Opens or moves forward the window of the person, inside the caller's transaction when one is handed in. */
    async touch(thread: ThreadTouch, manager: EntityManager = this.entityManager): Promise<void> {
        await manager.query(TOUCH_META_THREAD, [thread.connectionId, thread.platform, thread.userId, thread.at])
    }

    /** When the person last wrote to the Page on the platform (ms since the epoch), or null when they never did. */
    async lastUserAt(person: ThreadPerson): Promise<OptionalLastMessageAt> {
        const keys = [person.connectionId, person.platform, person.userId]
        const last = (await this.entityManager.query<Array<MetaThreadRow>>(FIND_META_THREAD, keys)).at(0)?.last_user_at
        if (last === undefined) return null
        return last instanceof Date ? last.getTime() : Date.parse(last)
    }
}
