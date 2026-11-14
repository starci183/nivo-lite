import { InputType } from "@nestjs/graphql"
import { WorkbenchFileItemInput } from "./workbench-file-item.input"

@InputType()
/** Bounded arguments to clear the file a record holds in one field, or one item of a list field, and remove it from the store. */
export class WorkbenchFileDeleteInput extends WorkbenchFileItemInput {}
