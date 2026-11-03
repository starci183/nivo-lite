import { Injectable } from "@nestjs/common"
import { OwnersService } from "@modules/domain/owners"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { WorkspacesService } from "@modules/domain/workspaces"
import { InjectChannelProvisioningOptions } from "./channel-provisioning.decorators"
import type { ChannelProvisioningOptions } from "./channel-provisioning.options"
import { readSeedDocuments } from "./management-seed.policy"
import type { TestSeat, TestWorkspace } from "./test-accounts-seed.contracts"
import { readTestAccountsSeed } from "./test-accounts-seed.policy"

@Injectable()
/**
 * The seed of the test seats: for each workspace its owner and the seats the owner adds, each a confirmed account holding the password
 * of the sealed member (a rerun sets the same password again). It runs as a data seed command of the stack, so the documents arrive on
 * stdin, already opened from their sealed member; it prints what it did and never a value.
 */
export class TestAccountsSeedService {
    constructor(
        @InjectChannelProvisioningOptions() private readonly options: ChannelProvisioningOptions,
        private readonly owners: OwnersService,
        private readonly workspaces: WorkspacesService,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** Applies every document of the stack seed envelope read from `text`; a document that is refused stops the run. */
    async run(text: string): Promise<void> {
        for (const document of readSeedDocuments(text)) {
            for (const workspace of readTestAccountsSeed(document).workspaces) await this.apply(workspace)
        }
    }

    private async apply({ name, owner, others }: TestWorkspace): Promise<void> {
        const ownerId = await this.account(owner)
        const { id } = await this.workspaces.ensureNamed(ownerId, name)
        this.options.print(`test workspace ${id}`)
        for (const seat of others) {
            const userId = await this.account(seat)
            await this.members.ensure(ownerId, {
                workspaceId: id,
                userId,
                role: seat.role,
                staffId: null,
                displayName: seat.name,
            })
            this.options.print(`${seat.role} seat ready in ${id}`)
        }
    }

    /** The account of a seat, with the sealed password set on it. */
    private async account(seat: TestSeat): Promise<string> {
        await this.owners.createOwner(seat.email, seat.password)
        return this.owners.ensureAccount(seat.email)
    }
}
