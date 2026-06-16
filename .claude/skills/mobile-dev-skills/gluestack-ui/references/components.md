# gluestack-ui component catalog & patterns

Reference for the gluestack-ui component set, their compound subcomponents, and variant props. Import every component from `@/components/ui/<kebab-name>`. Only use components that are actually installed in the project's `components/ui/` folder — add missing ones with `npx gluestack-ui add <name>`.

Variant prop values below reflect the common gluestack-ui defaults. If a project has customized a component's source, the installed component is the source of truth — open `components/ui/<name>/index.tsx` to confirm.

## Layout & structure

| Component | Import name(s) | Notes |
|---|---|---|
| Box | `Box` | Styled `View`. Base building block. |
| VStack | `VStack` | Vertical stack. `space="xs..4xl"` for gap; `reversed`. |
| HStack | `HStack` | Horizontal stack. Same `space`. |
| Center | `Center` | Centers children both axes. |
| Grid / GridItem | `Grid`, `GridItem` | v3 only. `numColumns`, `colSpan`. |
| Divider | `Divider` | `orientation="horizontal|vertical"`. |
| Card | `Card` | `size`, `variant="elevated|outline|ghost|filled"`. |

## Typography

| Component | Subcomponents | Variant props |
|---|---|---|
| Text | `Text` | `size=2xs..6xl`, `bold`, `italic`, `underline`, `strikeThrough` |
| Heading | `Heading` | `size=xs..6xl` |

Color via token classes: `text-typography-{0..950}`, `text-primary-{...}`, etc.

## Actions

### Button
```tsx
import { Button, ButtonText, ButtonIcon, ButtonSpinner, ButtonGroup } from "@/components/ui/button";
```
- `size`: `xs | sm | md | lg | xl`
- `variant`: `solid | outline | link`
- `action`: `primary | secondary | positive | negative`
- `isDisabled`, `onPress`
- Loading: render `<ButtonSpinner />` + optionally `<ButtonText>Saving...</ButtonText>`, set `isDisabled`.

### Fab (floating action button)
```tsx
import { Fab, FabLabel, FabIcon } from "@/components/ui/fab";
```
- `placement="top right" | "bottom right" | ...`, `size`.

### Pressable
```tsx
import { Pressable } from "@/components/ui/pressable";
```
Use for custom tappable surfaces when no semantic button fits.

## Forms & inputs

### Input
```tsx
import { Input, InputField, InputIcon, InputSlot } from "@/components/ui/input";
```
- `Input`: `variant="outline|underlined|rounded"`, `size`, `isInvalid`, `isDisabled`.
- `InputField`: the actual `TextInput` — put `value`, `onChangeText`, `placeholder`, `keyboardType`, `secureTextEntry`, `autoCapitalize` here.
- `InputSlot` + `InputIcon`: leading/trailing icons (e.g. password eye toggle).

### Textarea
```tsx
import { Textarea, TextareaInput } from "@/components/ui/textarea";
```

### Select
```tsx
import { Select, SelectTrigger, SelectInput, SelectIcon, SelectPortal,
         SelectBackdrop, SelectContent, SelectDragIndicatorWrapper,
         SelectDragIndicator, SelectItem } from "@/components/ui/select";
```
Trigger opens a portal/actionsheet of `SelectItem`s.

### Checkbox / Radio / Switch
```tsx
import { Checkbox, CheckboxIndicator, CheckboxIcon, CheckboxLabel, CheckboxGroup } from "@/components/ui/checkbox";
import { Radio, RadioGroup, RadioIndicator, RadioIcon, RadioLabel } from "@/components/ui/radio";
import { Switch } from "@/components/ui/switch";
```
- Checkbox/Radio use `value`; groups use `value` + `onChange`.
- `Switch`: `value`, `onValueChange`, `size`.

### Slider
```tsx
import { Slider, SliderTrack, SliderFilledTrack, SliderThumb } from "@/components/ui/slider";
```

### FormControl (wrap inputs for label/error/a11y)
```tsx
import { FormControl, FormControlLabel, FormControlLabelText,
         FormControlHelper, FormControlHelperText,
         FormControlError, FormControlErrorIcon, FormControlErrorText } from "@/components/ui/form-control";
```
- `isInvalid`, `isRequired`, `isDisabled` on `FormControl` cascade to children.

## Feedback & overlays

### Alert
```tsx
import { Alert, AlertText, AlertIcon } from "@/components/ui/alert";
```
- `action="error|warning|success|info|muted"`, `variant="solid|outline"`.

### Toast (hook-based)
```tsx
import { useToast, Toast, ToastTitle, ToastDescription } from "@/components/ui/toast";
const toast = useToast();
toast.show({ render: ({ id }) => (
  <Toast action="success" variant="solid">
    <ToastTitle>Saved</ToastTitle>
    <ToastDescription>Changes stored.</ToastDescription>
  </Toast>
)});
```

### Modal
```tsx
import { Modal, ModalBackdrop, ModalContent, ModalHeader, ModalCloseButton,
         ModalBody, ModalFooter } from "@/components/ui/modal";
```
- `isOpen`, `onClose`, `size="xs..full"`.

### Actionsheet (bottom sheet)
```tsx
import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator,
         ActionsheetDragIndicatorWrapper, ActionsheetItem, ActionsheetItemText } from "@/components/ui/actionsheet";
```

### AlertDialog
```tsx
import { AlertDialog, AlertDialogBackdrop, AlertDialogContent, AlertDialogHeader,
         AlertDialogBody, AlertDialogFooter, AlertDialogCloseButton } from "@/components/ui/alert-dialog";
```
Use for confirm/destructive prompts; `AlertDialog` adds the right a11y role vs plain `Modal`.

### Popover / Tooltip / Menu
```tsx
import { Popover, PopoverBackdrop, PopoverContent, PopoverArrow, PopoverHeader, PopoverBody } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipText } from "@/components/ui/tooltip";
import { Menu, MenuItem, MenuItemLabel } from "@/components/ui/menu";
```

### Spinner / Progress
```tsx
import { Spinner } from "@/components/ui/spinner";          // size, color
import { Progress, ProgressFilledTrack } from "@/components/ui/progress"; // value 0-100
```

## Data display

### Avatar
```tsx
import { Avatar, AvatarImage, AvatarFallbackText, AvatarBadge, AvatarGroup } from "@/components/ui/avatar";
```

### Badge
```tsx
import { Badge, BadgeText, BadgeIcon } from "@/components/ui/badge";
// action="error|warning|success|info|muted", variant="solid|outline"
```

### Image / Icon
```tsx
import { Image } from "@/components/ui/image";
import { Icon, AddIcon, CloseIcon, CheckIcon, ChevronDownIcon, /* ... */ createIcon } from "@/components/ui/icon";
```
- For lists/perf-sensitive imagery prefer `expo-image` directly; gluestack `Image` is fine for simple cases.
- Custom icons: `createIcon` or pass a lucide-react-native icon `as` the `as` prop on `Icon`.

### Accordion / Table
```tsx
import { Accordion, AccordionItem, AccordionHeader, AccordionTrigger,
         AccordionTitleText, AccordionIcon, AccordionContent, AccordionContentText } from "@/components/ui/accordion";
import { Table, TableHeader, TableBody, TableRow, TableData, TableHead } from "@/components/ui/table";
```

## Common composition recipes

**Loading button**
```tsx
<Button isDisabled={isPending} onPress={onSubmit}>
  {isPending && <ButtonSpinner />}
  <ButtonText className={isPending ? "ml-2" : undefined}>
    {isPending ? "Saving..." : "Save"}
  </ButtonText>
</Button>
```

**Confirm-delete dialog** → use `AlertDialog` (not `Modal`) with a `Button action="negative"` in the footer.

**Form field with react-hook-form** → wrap each `Controller`-rendered `Input` in a `FormControl`, drive `isInvalid` from `fieldState.error`, and surface the message in `FormControlErrorText`.
