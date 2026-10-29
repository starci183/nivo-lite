import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { WizardDraft } from "./zalo-wizard-drafts.contracts"
import { ZaloWizardDraftEntity } from "./persistence/entities"

const ABSENT: WizardDraft = { present: false, appId: "", appSecret: "", oaSecret: "" }

@Injectable()
/** The keys the Zalo wizard handed over for a connection while the back end seals them; the only reader and remover of zalo_wizard_drafts. */
export class ZaloWizardDraftsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The keys waiting for a connection; `present` is false when there are none (sealed already, or never written). */
    async draftOf(connectionId: string): Promise<WizardDraft> {
        const row = await this.entityManager.findOneBy(ZaloWizardDraftEntity, { connectionId })
        if (row === null) return ABSENT
        return {
            present: true,
            appId: row.appId ?? "",
            appSecret: row.appSecret ?? "",
            oaSecret: row.oaSecret ?? "",
        }
    }

    /** Removes the draft of a connection once its keys are sealed. */
    async dropDraft(connectionId: string): Promise<void> {
        await this.entityManager.delete(ZaloWizardDraftEntity, { connectionId })
    }
}
