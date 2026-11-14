import { InputType } from "@nestjs/graphql"
import { WorkbenchFileKeyInput } from "./workbench-file-key.input"

@InputType()
/** Bounded arguments to confirm an uploaded file and get the reference. */
export class WorkbenchFileConfirmInput extends WorkbenchFileKeyInput {}
