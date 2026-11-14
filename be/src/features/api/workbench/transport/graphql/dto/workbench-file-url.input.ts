import { InputType } from "@nestjs/graphql"
import { WorkbenchFileItemInput } from "./workbench-file-item.input"

@InputType()
/** Bounded arguments for a short-lived signed read address of the file a record holds in one field, or one item of a list field. */
export class WorkbenchFileUrlInput extends WorkbenchFileItemInput {}
