import { Input, NumberField, Textarea, Grid } from "@starci/grammar/common"
import type { HiringJobFieldCommands, HiringViews } from "@/modules/types"
/** The words, values and changes of the requirement fields of a job. */
interface HiringRequirementFieldsProps extends HiringJobFieldCommands {
    readonly copy: HiringViews["workbenchCopy"]
    readonly values: HiringViews["jobFormValues"]
}

/** What a job screens candidates on: skills, hours, must-haves, nice-to-haves, years and the experience note. */
export const HiringRequirementFields = (props: HiringRequirementFieldsProps) => {
    const { copy, values, onText, onNumber } = props
    return (
        <Grid kind="form" columns={2}>
            <Textarea
                label={copy.jobSkills}
                description={copy.jobSkillsHint}
                rows={3}
                value={values.skills}
                onValueChange={(skills) => onText("skills", skills)}
            />
            <Textarea
                label={copy.jobAvailability}
                description={copy.jobAvailabilityHint}
                rows={3}
                value={values.availability}
                onValueChange={(availability) => onText("availability", availability)}
            />
            <Textarea
                label={copy.jobMustHave}
                description={copy.jobMustHaveHint}
                rows={3}
                value={values.mustHave}
                onValueChange={(mustHave) => onText("mustHave", mustHave)}
            />
            <Textarea
                label={copy.jobNiceToHave}
                description={copy.jobNiceToHaveHint}
                rows={3}
                value={values.niceToHave}
                onValueChange={(niceToHave) => onText("niceToHave", niceToHave)}
            />
            <NumberField
                label={copy.jobYears}
                minValue={0}
                maxValue={50}
                step={1}
                {...(values.years === null ? {} : { value: values.years })}
                onValueChange={(value) => onNumber("years", Number.isFinite(value) ? value : null)}
            />
            <Input
                id="job-exp-note"
                name="experience_note"
                label={copy.jobExperienceNote}
                value={values.experienceNote}
                onValueChange={(note) => onText("experienceNote", note)}
            />
        </Grid>
    )
}
