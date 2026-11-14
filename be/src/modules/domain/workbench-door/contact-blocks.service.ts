import { Injectable } from "@nestjs/common"
import type { ModuleContactBlock } from "@nivo-lite/agent-sdk/module"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { ContactsError, ContactsErrorCode, ContactsService } from "@modules/domain/contacts"
import { ModuleInstallService, type InstallationView } from "@modules/domain/modules"
import { contactBlockViewOf } from "./contact-blocks.policy"
import type { ContactBlocksRequest, ContactModuleAgentView, ContactModuleBlockView } from "./contact-blocks.contracts"
import { WorkbenchDoorError, WorkbenchDoorErrorCode } from "./errors/workbench-door.error"
import { InjectWorkbenchDoorOptions } from "./workbench-door.decorators"
import type { WorkbenchDoorOptions } from "./workbench-door.options"
import { WorkbenchDoorService } from "./workbench-door.service"

/** The state of an uninstalled agent: its history stays, nothing of it is a block of a person. */
const REMOVED = "removed"

@Injectable()
/**
 * What each installed agent's module knows about one person, for the module blocks of the contact detail. The engine draws no business: each
 * module declares which of its reads shows for a contact and with which generic block (`contactBlocks`), and every read runs through the
 * SAME door a screen's `workbenchRead` takes, as the member (the read's own permission; an agent whose read the member may not run is left
 * out), with the contact id as its one variable and the first rows only.
 */
export class ContactBlocksService {
    constructor(
        @InjectWorkbenchDoorOptions() private readonly options: WorkbenchDoorOptions,
        private readonly access: AgentWorkAccessService,
        private readonly contacts: ContactsService,
        private readonly installs: ModuleInstallService,
        private readonly door: WorkbenchDoorService,
    ) {}

    /**
     * The agents with the blocks the member may see (a manager or the owner, as for the contact page). A contact the workspace does not
     * hold (unknown, erased or of another workspace) is not found. A module without contact blocks, an uninstalled agent and an agent whose
     * every read is forbidden are not listed.
     */
    async list(principalId: string, request: ContactBlocksRequest): Promise<ReadonlyArray<ContactModuleAgentView>> {
        await this.access.manager(principalId, request.workspaceId)
        const contact = await this.contacts.get(request.workspaceId, request.contactId)
        if (contact === null) throw new ContactsError({ code: ContactsErrorCode.ContactMissing })
        const installations = await this.installs.list(principalId, request.workspaceId)
        const agents = await Promise.all(
            installations
                .filter((installation) => installation.status !== REMOVED)
                .map((installation) => this.agentOf(principalId, request, contact.id, installation)),
        )
        return agents.filter((agent): agent is ContactModuleAgentView => agent !== null)
    }

    /** One installed agent with the blocks of its module the member may see; null when its module declares none or every read is forbidden. */
    private async agentOf(
        principalId: string,
        request: ContactBlocksRequest,
        contactId: string,
        installation: InstallationView,
    ): Promise<ContactModuleAgentView | null> {
        const declared = this.options.modules.find((module) => module.key === installation.moduleKey)?.contactBlocks ?? []
        const answered = await Promise.all(
            declared.map((block) => this.blockOf(principalId, request, contactId, installation.id, block)),
        )
        const blocks = answered.filter((block): block is ContactModuleBlockView => block !== null)
        if (blocks.length === 0) return null
        return {
            installationId: installation.id,
            agentId: installation.agentId,
            agentName: installation.agentName,
            moduleKey: installation.moduleKey,
            blocks,
        }
    }

    /** One block with the first rows its read gave for the contact; null when the member may not run the read. */
    private async blockOf(
        principalId: string,
        request: ContactBlocksRequest,
        contactId: string,
        installationId: string,
        block: ModuleContactBlock,
    ): Promise<ContactModuleBlockView | null> {
        try {
            const answer = await this.door.read(principalId, {
                workspaceId: request.workspaceId,
                name: block.read,
                payload: JSON.stringify({ contactId }),
                locale: request.locale,
                installationId,
            })
            return contactBlockViewOf(block, contactId, request.locale, answer.data)
        } catch (cause) {
            if (cause instanceof WorkbenchDoorError && cause.code === WorkbenchDoorErrorCode.PermissionDenied) return null
            throw cause
        }
    }
}
