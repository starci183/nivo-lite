import { Injectable } from "@nestjs/common"
import { MoreThanOrEqual } from "typeorm"
import type { EntityManager, FindOptionsWhere } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { EmailRecord, OptionalVia } from "./email-messages.contracts"
import { EmailMessagesError, EmailMessagesErrorCode } from "./errors/email-messages.error"
import { EmailMessageEntity } from "./persistence/entities"
import type { EmailMessageRefs } from "./persistence/entities"

@Injectable()
/** The log of every email attempt of a workspace: the only writer of public.email_messages. */
export class EmailMessagesService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Writes down one send attempt and answers its id. */
    async record(entry: EmailRecord): Promise<string> {
        const result = await this.entityManager.insert(EmailMessageEntity, {
            workspaceId: entry.workspaceId,
            connectionId: entry.connectionId,
            toAddress: entry.to.slice(0, 254),
            subject: entry.subject.slice(0, 300),
            purpose: entry.purpose.slice(0, 60),
            status: entry.status,
            via: entry.via,
            providerMessageId: entry.providerMessageId,
            error: entry.error === null ? null : entry.error.slice(0, 600),
            refs: { ...entry.refs } as EmailMessageRefs,
        })
        const id = (result.identifiers[0] as { readonly id?: string } | undefined)?.id
        if (id === undefined) throw new EmailMessagesError({ code: EmailMessagesErrorCode.NotRecorded })
        return id
    }

    /** How many messages the workspace sent since a time, optionally only through one sender. */
    sentSince(workspaceId: string, since: Date, via: OptionalVia): Promise<number> {
        const where: FindOptionsWhere<EmailMessageEntity> = {
            workspaceId,
            status: "sent",
            createdAt: MoreThanOrEqual(since),
        }
        if (via !== null) where.via = via
        return this.entityManager.count(EmailMessageEntity, { where })
    }

    /** True when a customer email waiting for the decision on this work item is already written down. */
    async isWaitingFor(workspaceId: string, workItemId: string): Promise<boolean> {
        const row = await this.entityManager
            .createQueryBuilder(EmailMessageEntity, "email")
            .select("email.id")
            .where("email.workspaceId = :workspaceId", { workspaceId })
            .andWhere("email.status = 'waiting_decision'")
            .andWhere("email.refs ->> 'work_item_id' = :workItemId", { workItemId })
            .limit(1)
            .getOne()
        return row !== null
    }
}
