import { Checkbox as HeroCheckbox } from "@heroui/react";
import { TextAction } from "@starci/grammar/common";

/**
 * LEAF - `Checkbox`: a choice the reader makes about the form around it.
 *
 * IT IS CONTROLLED, unlike the text boxes beside it. A tick is a decision the surface has to act
 * on immediately - a submit refused until terms are agreed cannot wait to read the value at
 * submit time - so this one reports on change while the boxes stay uncontrolled.
 *
 * THE LABEL IS PART OF THE CONTROL, not a `Text` beside it: the whole row has to be pressable, and
 * a label that only sits nearby leaves a target the width of the tick itself.
 */

/** One textual or navigable fragment inside a compound checkbox label. */
export type CheckboxLabelPart =
{readonly kind: "text";readonly content: string;} |
{readonly kind: "link";readonly id: string;readonly label: string;};

/** What this leaf draws. A `type`, not an `interface` - only an alias satisfies the data fence. */
export type CheckboxData = {
  /** The already-resolved words beside the tick. */
  readonly label: string;
  /** Optional sentence anatomy when part of the label has its own destination. */
  readonly labelParts?: ReadonlyArray<CheckboxLabelPart>;
  /** Whether it is ticked. Controlled - see the file header. */
  readonly isSelected: boolean;
  /** The form field name, for the submitted payload. */
  readonly name?: string;
};

/** What ticking it does. */
export type CheckboxActions = {
  /** Called with the new value when the reader changes it. */
  readonly change?: (isSelected: boolean) => void;
  /** Reports which navigable phrase was followed; connected code owns routing. */
  readonly follow?: (id: string) => void;
};

/** Props for {@link Checkbox}. Three fixed slots, no fourth - see {@link LeafProps}. */
export type CheckboxProps = {readonly props: CheckboxData;readonly on?: CheckboxActions;readonly isLoading?: boolean;};

/** The tick and its words on one baseline, with the whole row pressable. */
const ROOT_CLASSES = "flex flex-row items-center gap-2 text-sm";

/**
 * Draw a choice.
 *
 * @param input - {@link CheckboxProps}
 */
export const Checkbox = (props: CheckboxProps) => CheckboxView(props);
const CheckboxView = ({ props, on }: CheckboxProps) =>
<HeroCheckbox


  data-selected={props.isSelected ? "true" : "false"}
  aria-label={props.label}
  name={props.name}
  isSelected={props.isSelected}
  onChange={(isSelected: boolean) => on?.change?.(isSelected)}
  className={ROOT_CLASSES}>
  
        <HeroCheckbox.Content>
            <HeroCheckbox.Control>
                <HeroCheckbox.Indicator />
            </HeroCheckbox.Control>
            {props.labelParts === undefined ? props.label :
    <span>
                    {props.labelParts.map((part, index) =>
      part.kind === "text" ?
      <span key={`${part.kind}-${index}`}>{part.content}</span> :

      <TextAction
        key={`${part.kind}-${index}`}
        size="sm"
        onPress={() => on?.follow?.(part.id)}
      >{part.label}</TextAction>


      )}
                </span>
    }
        </HeroCheckbox.Content>
    </HeroCheckbox>;


