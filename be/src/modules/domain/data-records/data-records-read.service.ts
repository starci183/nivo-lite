import { Injectable } from "@nestjs/common"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    CustomerRecordRows,
    MailAttachments,
    OptionalMailAttachments,
    OptionalSinceDay,
} from "./data-records-read.contracts"
import { DataRecordEntity } from "./persistence/entities"

@Injectable()
/** Request-time reads of the hub rows for other capabilities, always scoped to the workspace and bounded by the caller. */
export class DataRecordsReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The newest mail rows of the workspace that carry an XML attachment, optionally from a date on, with their attachments. */
    mailsWithXml(workspaceId: string, since: OptionalSinceDay, limit: number): Promise<Array<MailAttachments>> {
        const query = this.mailQuery(workspaceId)
            .andWhere("jsonb_path_exists(r.data, CAST(:attachmentsPath AS jsonpath))", {
                attachmentsPath: "$.attachments[*].xml",
            })
            .orderBy("r.occurred_at", "DESC", "NULLS LAST")
            .limit(limit)
        if (since !== undefined) query.andWhere("r.occurred_at >= CAST(:since AS date)", { since })
        return query.getRawMany<MailAttachments>()
    }

    /** The mail row of the workspace with this id and its attachments; none when the workspace has no such mail. */
    async mailAttachments(workspaceId: string, recordId: string): Promise<OptionalMailAttachments> {
        const rows = await this.mailQuery(workspaceId)
            .andWhere("CAST(r.id AS text) = :recordId", { recordId })
            .limit(1)
            .getRawMany<MailAttachments>()
        return rows[0]
    }

    /** The newest customer rows of the workspace, at most `limit`, each with the connection it was synced from. */
    async customerRecords(workspaceId: string, limit: number): Promise<Array<CustomerRecordRows>> {
        const rows = await this.entityManager.find(DataRecordEntity, {
            select: { connectionId: true, externalId: true, title: true, data: true },
            where: { workspaceId, entity: "customer" },
            order: { syncedAt: "DESC", id: "ASC" },
            take: limit,
        })
        return rows.map((row) => ({
            connectionId: row.connectionId,
            externalId: row.externalId,
            title: row.title,
            data: Object.fromEntries(Object.entries(row.data)),
        }))
    }

    /** The mail rows of the workspace with the attachments the sync kept on each. */
    private mailQuery(workspaceId: string): SelectQueryBuilder<DataRecordEntity> {
        return this.entityManager
            .createQueryBuilder(DataRecordEntity, "r")
            .select("r.id", "id")
            .addSelect("r.data -> 'attachments'", "attachments")
            .where("r.workspace_id = :workspaceId AND r.entity = 'message'", { workspaceId })
    }
}
