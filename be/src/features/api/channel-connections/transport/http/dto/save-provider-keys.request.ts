import { IsObject } from "class-validator"

/** The bounded HTTP body of the SaveProviderKeys operation. */
export class SaveProviderKeysBody {
    /** The values sent by the caller. */
    @IsObject()
    values!: Record<string, string>
}
