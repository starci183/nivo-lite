import { Alert, Badge, NumberField, Select, Slider } from "@starci/grammar/common"
import { BAND_FIELDS_CLASS_NAME, LEGEND_CLASS_NAME, SECTION_CLASS_NAME } from "./classNames"

const WHOLE = { maximumFractionDigits: 2 }

/** The words and state of the band fields. */
export interface PermissionBandsFieldsProps {
    readonly props: {
        /** The unit of the bounds. */
        readonly unit: string
        /** The largest amount the rule runs alone; NaN while blank. */
        readonly autoMax: number
        /** The largest amount that still asks; NaN while blank. */
        readonly askMax: number
        /** The largest bound the slider offers; 0 hides it. */
        readonly sliderMax: number
        readonly unitOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly legend: { readonly auto: string; readonly ask: string; readonly never: string }
        /** True when the bounds typed are not enough to save. */
        readonly isInvalid: boolean
        readonly copy: {
            readonly unitLabel: string
            readonly autoMaxLabel: string
            readonly askMaxLabel: string
            readonly sliderLabel: string
            readonly bandsInvalid: string
        }
    }
    readonly on: {
        readonly unit: (value: string | null) => void
        readonly autoMax: (value: number) => void
        readonly askMax: (value: number) => void
        readonly slider: (values: ReadonlyArray<number>) => void
    }
}

/** The unit, the two bounds, their slider and the legend of the three bands. */
export const PermissionBandsFields = (props: PermissionBandsFieldsProps) => {
    const { props: p, on } = props
    return (
        <div className={SECTION_CLASS_NAME}>
            <Select label={p.copy.unitLabel} options={p.unitOptions} value={p.unit} onValueChange={on.unit} />
            <div className={BAND_FIELDS_CLASS_NAME}>
                <NumberField
                    label={p.copy.autoMaxLabel}
                    minValue={0}
                    formatOptions={WHOLE}
                    value={p.autoMax}
                    onValueChange={on.autoMax}
                />
                <NumberField
                    label={p.copy.askMaxLabel}
                    minValue={0}
                    formatOptions={WHOLE}
                    value={p.askMax}
                    onValueChange={on.askMax}
                />
            </div>
            {p.sliderMax > 0 ? (
                <Slider
                    label={p.copy.sliderLabel}
                    isLabelHidden
                    minValue={0}
                    maxValue={p.sliderMax}
                    step={1}
                    thumbLabels={[p.copy.autoMaxLabel, p.copy.askMaxLabel]}
                    value={[
                        Number.isFinite(p.autoMax) ? p.autoMax : 0,
                        Number.isFinite(p.askMax) ? p.askMax : p.sliderMax,
                    ]}
                    onValueChange={(values) => on.slider(typeof values === "number" ? [values] : values)}
                />
            ) : null}
            <div className={LEGEND_CLASS_NAME}>
                <Badge tone="success" isDot>
                    {p.legend.auto}
                </Badge>
                <Badge tone="warning" isDot>
                    {p.legend.ask}
                </Badge>
                <Badge tone="danger" isDot>
                    {p.legend.never}
                </Badge>
            </div>
            {p.isInvalid ? <Alert tone="negative" title={p.copy.bandsInvalid} /> : null}
        </div>
    )
}
