# Component catalog (radix base)

Authoritative list of shadcn/ui components available for this project. **Before relying on a
component's API, run `npx shadcn@latest docs <name> --base radix`** — APIs evolve and the `radix`
base differs from the `base` base. Install with `npx shadcn@latest add <name>`.

## Quick install per component

| Component | Add command | Notes |
|-----------|-------------|-------|
| Accordion | `add accordion` | Collapsible sections |
| Alert | `add alert` | Inline callout |
| Alert Dialog | `add alert-dialog` | Confirm destructive actions |
| Aspect Ratio | `add aspect-ratio` | |
| Avatar | `add avatar` | |
| Badge | `add badge` | Use `variant` for status colors |
| Breadcrumb | `add breadcrumb` | |
| Button | `add button` | Use `variant` / `size` props |
| Button Group | `add button-group` | Group related buttons |
| Calendar | `add calendar` | Date primitive (base of Date Picker) |
| Card | `add card` | Card + Header/Title/Description/Content/Footer |
| Carousel | `add carousel` | |
| Chart | `add chart` | Recharts wrapper; uses `chart-*` tokens |
| Checkbox | `add checkbox` | |
| Collapsible | `add collapsible` | |
| Combobox | `add combobox` | Composed: Popover + Command |
| Command | `add command` | Command palette / ⌘K |
| Context Menu | `add context-menu` | Right-click menu |
| Data Table | `add data-table` | Composed with TanStack Table + Table |
| Date Picker | `add date-picker` | Composed: Popover + Calendar |
| Dialog | `add dialog` | Modal |
| Drawer | `add drawer` | Mobile-friendly bottom sheet (vaul) |
| Dropdown Menu | `add dropdown-menu` | |
| Empty | `add empty` | Empty-state pattern |
| Field | `add field` | **Form building block** — see composition.md |
| Hover Card | `add hover-card` | |
| Input | `add input` | |
| Input Group | `add input-group` | Input with addons/affixes |
| Input OTP | `add input-otp` | One-time-code input |
| Item | `add item` | List item primitive |
| Kbd | `add kbd` | Keyboard key styling |
| Label | `add label` | Prefer via `FieldLabel` in forms |
| Menubar | `add menubar` | App menu bar |
| Native Select | `add native-select` | Plain `<select>` styled |
| Navigation Menu | `add navigation-menu` | |
| Pagination | `add pagination` | |
| Popover | `add popover` | |
| Progress | `add progress` | |
| Radio Group | `add radio-group` | Single-choice form field |
| Resizable | `add resizable` | Resizable panes |
| Scroll Area | `add scroll-area` | |
| Select | `add select` | Rich select (Radix) |
| Separator | `add separator` | |
| Sheet | `add sheet` | Side panel |
| Sidebar | `add sidebar` | App sidebar — uses `sidebar-*` tokens |
| Skeleton | `add skeleton` | Loading placeholder |
| Slider | `add slider` | |
| Sonner | `add sonner` | **Toasts** — preferred over deprecated Toast |
| Spinner | `add spinner` | Loading indicator |
| Switch | `add switch` | |
| Table | `add table` | Static table primitives |
| Tabs | `add tabs` | |
| Textarea | `add textarea` | |
| Toast | `add toast` | **Deprecated** — use Sonner |
| Toggle | `add toggle` | |
| Toggle Group | `add toggle-group` | **Sets of options** |
| Tooltip | `add tooltip` | |

## Composite components (made of several parts)

Some "components" are documented patterns composed from primitives. Installing them pulls the parts:

- **Combobox** = `Popover` + `Command`.
- **Date Picker** = `Popover` + `Calendar`.
- **Data Table** = `Table` + TanStack Table (`@tanstack/react-table`) for sorting/filtering/pagination.

When building these, follow the docs example (`npx shadcn@latest docs combobox`) rather than wiring
the parts from scratch.

## Choosing the right component

- Confirm/destructive action → **Alert Dialog**, not Dialog.
- Notification/toast → **Sonner**.
- Single choice in a form → **Radio Group**; multiple independent toggles → **Toggle Group**.
- Searchable single-select → **Combobox**; command palette → **Command**.
- Side panel → **Sheet**; mobile bottom sheet → **Drawer**.
- App chrome with collapsible nav → **Sidebar** (built for the `sidebar-*` theme tokens).
- Loading → **Skeleton** (content placeholder) or **Spinner** (action in progress).
- Nothing to show → **Empty**.

If a component you need isn't listed, search the registry first:
`npx shadcn@latest search @shadcn -q "<keyword>"`. Only compose a custom wrapper from shadcn
primitives if the registry truly lacks it.
