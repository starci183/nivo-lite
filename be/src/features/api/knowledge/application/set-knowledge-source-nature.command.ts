import { Command } from "@nestjs/cqrs"
import type { NatureAnswered } from "@modules/domain/brain"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetKnowledgeSourceNatureRequest } from "./set-knowledge-source-nature.contracts"

/** The founder says what a document is (its rules, records, a log, reference), over the model's reading. */
export class SetKnowledgeSourceNatureCommand extends Command<NatureAnswered> {
    constructor(readonly params: ExecuteParams<SetKnowledgeSourceNatureRequest>) {
        super()
    }
}
