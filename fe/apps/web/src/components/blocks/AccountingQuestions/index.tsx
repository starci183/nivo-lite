import { getTranslations } from "next-intl/server"
import type { Staff } from "@/lib/flow-types"
import type { AccountingQuestion, AccountingQuestionGroup } from "@/modules/types"
import { AccountingQuestionsBase } from "./component"

/** The waiting accounting work, who can take it and who the owner is. */
interface AccountingQuestionsProps {
    readonly questions: ReadonlyArray<AccountingQuestion>
    readonly staff: ReadonlyArray<Staff>
    readonly ownerName: string
}

/** The groups in the order the owner reads them. */
const GROUPS: ReadonlyArray<AccountingQuestionGroup> = ["unclear_payment", "over_limit", "missing_data", "other"]

/** The Questions tab with its copy resolved on the server. */
export const AccountingQuestions = async (props: AccountingQuestionsProps) => {
    const t = await getTranslations("workbenchAccounting")
    return (
        <AccountingQuestionsBase
            props={{
                intro: t("questionsIntro"),
                empty: t("questionsEmpty"),
                emptyBody: t("questionsEmptyBody"),
                groups: GROUPS.map((group) => ({
                    id: group,
                    title: t(`group_${group}`),
                    hint: t(`groupHint_${group}`),
                    items: props.questions
                        .filter((question) => question.group === group)
                        .map((question) => question.item),
                })).filter((group) => group.items.length > 0),
                staff: props.staff,
                ownerName: props.ownerName,
            }}
        />
    )
}
