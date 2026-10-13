import { IsIn } from "class-validator"

/** The bounded HTTP request that decides a lesson. */
export class DecideLessonRequest {
    /** active or rejected for a proposal; retired for a lesson in force. */
    @IsIn(["active", "rejected", "retired"])
    action!: "active" | "rejected" | "retired"
}
