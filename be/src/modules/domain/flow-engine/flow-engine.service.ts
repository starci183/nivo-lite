import { Injectable } from "@nestjs/common"
import { ChatReplyService } from "@modules/domain/chatreply"
import { DecisionsService, WorkDecisionService, WorkPlacementService } from "@modules/domain/decisions"
import type { FlowGate, FlowPayload, FlowResult } from "@modules/domain/flows"
import { StaffService } from "@modules/domain/staff"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { AuthorityChatService } from "./authority-chat.service"
import {
    authorityPatchOf,
    chatTextOf,
    conversationIdOf,
    editsOf,
    localeOf,
    noteOf,
    ruleChangeOf,
    staffIdOf,
    staffWriteOf,
    takeOf,
    verdictOf,
    workItemIdOf,
} from "./flow-command.mapper"
import { OwnerChatService } from "./owner-chat.service"

/** One command of the flow as the engine runs it. */
type FlowCommand = Parameters<FlowGate["run"]>[0]

/** The answer of a command: the record it produced, as named values. */
const answer = (data: object): FlowResult => ({ data: { ...data } })

@Injectable()
/**
 * The operating-flow engine behind the flows doors: each command goes to the capability that owns it (the authority sheet and
 * rules, the staff directory, the work decisions, the conversation takeover, the owner's Office chat) as the
 * member who asked. The flows facade has proved membership and the manager role; the owners apply their own rules.
 */
export class FlowEngineService implements FlowGate {
    constructor(
        private readonly decisions: DecisionsService,
        private readonly work: WorkDecisionService,
        private readonly placement: WorkPlacementService,
        private readonly staff: StaffService,
        private readonly chats: ChatReplyService,
        private readonly authorityChat: AuthorityChatService,
        private readonly ownerChat: OwnerChatService,
    ) {}

    /** Runs one command and answers what it produced (the authority, the rule, the staff row, the work item...). */
    async run(command: FlowCommand): Promise<FlowResult> {
        const { member, payload, workspaceId } = command
        const locale = localeOf(payload)
        const userId = member.userId
        switch (command.kind) {
            case "save_authority":
                return answer(await this.decisions.updateAuthority(userId, workspaceId, authorityPatchOf(payload)))
            case "save_rule":
                return answer(await this.saveRule(userId, workspaceId, payload))
            case "save_staff":
                return answer(await this.staff.save(staffWriteOf(workspaceId, payload)))
            case "decide":
                return answer(
                    await this.work.decide(userId, workspaceId, {
                        workItemId: workItemIdOf(payload),
                        decision: verdictOf(payload),
                        edits: editsOf(payload),
                        note: noteOf(payload, "note"),
                        basis: noteOf(payload, "basis"),
                        locale,
                    }),
                )
            case "hold":
                return answer(
                    await this.placement.hold(userId, workspaceId, {
                        workItemId: workItemIdOf(payload),
                        note: noteOf(payload, "note") ?? "",
                        locale,
                    }),
                )
            case "assign":
                return answer(
                    await this.placement.assign(userId, workspaceId, {
                        workItemId: workItemIdOf(payload),
                        staffId: staffIdOf(payload),
                        locale,
                    }),
                )
            case "take_over":
                return answer(await this.takeOver(userId, workspaceId, payload))
            case "send_as_human":
                return answer(
                    await this.chats.requestReply(userId, workspaceId, {
                        conversationId: conversationIdOf(payload),
                        body: chatTextOf(payload),
                        locale,
                    }),
                )
            case "authority_from_chat":
                return answer(
                    await this.authorityChat.apply(this.inWorkspace(member, workspaceId), chatTextOf(payload), locale),
                )
            case "owner_chat":
                return answer(
                    await this.ownerChat.reply(this.inWorkspace(member, workspaceId), chatTextOf(payload), locale),
                )
        }
    }

    private async saveRule(userId: string, workspaceId: string, payload: FlowPayload): Promise<object> {
        return this.decisions.saveRule(userId, workspaceId, ruleChangeOf(payload))
    }

    private async takeOver(userId: string, workspaceId: string, payload: FlowPayload): Promise<object> {
        const result = await this.chats.setHandling(
            userId,
            workspaceId,
            conversationIdOf(payload),
            takeOf(payload),
            localeOf(payload),
        )
        return { conversation_id: result.conversationId, handled_by: result.handledBy }
    }

    /** The member as the chat services read it, in the workspace of the command. */
    private inWorkspace(member: WorkspaceMember, workspaceId: string): WorkspaceMember {
        return { ...member, workspaceId }
    }
}
