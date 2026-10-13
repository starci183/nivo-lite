import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ThreadTouch } from "./meta-threads.contracts"
import { TOUCH_META_THREAD } from "./persistence/meta-threads.sql"

@Injectable()
/** Owns the messaging windows: the one writer of meta_threads. */
export class MetaThreadsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Opens or moves forward the window of the person, inside the caller's transaction when one is handed in. */
    async touch(thread: ThreadTouch, manager: EntityManager = this.entityManager): Promise<void> {
        await manager.query(TOUCH_META_THREAD, [thread.connectionId, thread.platform, thread.userId, thread.at])
    }
}
