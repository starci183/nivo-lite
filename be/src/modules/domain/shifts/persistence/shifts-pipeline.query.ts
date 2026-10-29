import type { EntityManager, SelectQueryBuilder } from "typeorm"
import type { ObjectLiteral } from "typeorm"

/** The template of the shift reminder automation. */
export const REMINDER_TEMPLATE = "shifts_shift_reminder"
/** The template of the monthly hours close automation. */
export const MONTH_CLOSE_TEMPLATE = "shifts_month_close"
/** The most workspaces one tick reads. */
export const PIPELINES_MAX = 2000

/** A read of the workspaces that switched one automation template on, oldest id first; the caller picks the columns. */
export const selectEnabledPipelines = (manager: EntityManager, template: string): SelectQueryBuilder<ObjectLiteral> =>
    manager
        .createQueryBuilder()
        .from("public.automation_pipelines", "p")
        .where("p.template_key = :template AND p.enabled", { template })
        .orderBy("p.workspace_id", "ASC")
        .limit(PIPELINES_MAX)

/** Whether the shift reminders of one workspace are on. */
export const isReminderOn = async (manager: EntityManager, workspaceId: string): Promise<boolean> => {
    const row = await manager
        .createQueryBuilder()
        .select("p.enabled", "enabled")
        .from("public.automation_pipelines", "p")
        .where("p.workspace_id = :workspaceId AND p.template_key = :template", {
            workspaceId,
            template: REMINDER_TEMPLATE,
        })
        .limit(1)
        .getRawOne<{ enabled: boolean }>()
    return row?.enabled === true
}
