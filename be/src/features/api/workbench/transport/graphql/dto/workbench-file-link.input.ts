import { InputType } from "@nestjs/graphql"
import { WorkbenchFileKeyInput } from "./workbench-file-key.input"

@InputType()
/** Bounded arguments to attach a confirmed upload to a record's file field. */
export class WorkbenchFileLinkInput extends WorkbenchFileKeyInput {}
