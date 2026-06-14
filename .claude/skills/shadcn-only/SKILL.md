---
name: shadcn-only
description: Use this skill for ANY UI work in this project — creating, editing, restyling, or composing components, pages, forms, dialogs, modals, tables, sidebars, cards, inputs, layouts, dashboards, navigation, or anything visual. This project is built EXCLUSIVELY with shadcn/ui on Vite + React + TypeScript + Tailwind v4. Trigger whenever the user mentions a button, form, modal, table, sidebar, card, input, page, screen, theme, dark mode, or any frontend/UI element — even if they never say the word "shadcn". The skill enforces the shadcn-only rule, the correct CLI install workflow, the project theme, and shadcn's composition conventions.
---

# shadcn-only

This project's UI is built **exclusively** with [shadcn/ui](https://ui.shadcn.com) and its
conventions. Stack: **Vite + React + TypeScript + Tailwind v4**, base library **radix**, preset
**`b27JkRsW`** (the project theme — see `assets/index.css`).

## The Golden Rule

> **Every visual element comes from a shadcn/ui component or is composed from shadcn primitives.**

Concretely:

- **Never hand-roll** a primitive that shadcn already provides (button, input, dialog, dropdown,
  tabs, table, tooltip, etc.). Install it instead.
- **Never add another component/UI library** (MUI, Ant, Chakra, Mantine, Flowbite, DaisyUI,
  Headless UI, bare Radix, react-bootstrap, …). If something is missing, check the shadcn registry
  and registries it supports before writing anything custom.
- **Never hardcode colors, radii, or shadows.** Use the project's semantic Tailwind tokens
  (`bg-primary`, `text-muted-foreground`, `border-input`, `rounded-md`, …) which map to the theme.
- When a need genuinely isn't covered, compose a small wrapper **out of shadcn primitives** and
  place it in `src/components/` (not in `src/components/ui/`, which is reserved for CLI-generated
  components).

If you ever feel tempted to write a raw `<button className="...">` or a custom modal from
`useState` + a fixed `<div>`, stop — that's the signal to install the shadcn component instead.

## Always start by reading the project

Before generating any UI, learn the actual project config. Run:

```bash
npx shadcn@latest info --json
```

This returns the framework, Tailwind version, aliases, **base library** (`radix` or `base` — APIs
differ between them), icon library, installed components, and resolved paths. Generate code against
*these* facts, not assumptions. If `components.json` is missing, the project isn't initialized yet —
see "First-time setup".

## Mandatory workflow for every UI request

1. **Detect** — `npx shadcn@latest info --json` to know what's installed and the base library.
2. **Discover** — if you're unsure a component exists or how its current API looks:
   - `npx shadcn@latest search @shadcn -q "<keyword>"` to find it,
   - `npx shadcn@latest docs <component>` (add `--base radix`) for the up-to-date API,
   - `npx shadcn@latest view <component>` to inspect source before installing.
   Don't reconstruct a component's API from memory — APIs change. Look it up.
3. **Install** — add anything not yet present: `npx shadcn@latest add <component>`.
4. **Compose** — import from the project alias and follow the composition conventions below.
5. **Theme** — style only with semantic tokens; verify it works in light *and* dark mode.

## CLI quick reference

| Task | Command |
|------|---------|
| Project config (always run first) | `npx shadcn@latest info --json` |
| Find a component | `npx shadcn@latest search @shadcn -q "calendar"` |
| Read current API/docs | `npx shadcn@latest docs button --base radix` |
| Preview source before adding | `npx shadcn@latest view dialog` |
| Add a component | `npx shadcn@latest add dialog` |
| Add several at once | `npx shadcn@latest add card button input label` |
| Preview without writing | `npx shadcn@latest add table --dry-run` |
| Re-apply only the theme | `npx shadcn@latest apply b27JkRsW --only theme` |

Use `npx` (this project's package manager). Full catalog and the install command per component are
in `references/components.md`. Full conventions are in `references/composition.md` — **read it before
building forms, option groups, empty states, or sidebars.**

## Composition conventions (the shadcn way)

These are the patterns shadcn's own tooling enforces. Follow them so generated UI matches the
ecosystem on the first try:

- **Forms → `Field` / `FieldGroup`.** Build forms by composing `Field`, `FieldLabel`,
  `FieldDescription`, `FieldError` inside a `FieldGroup`. For validated forms, pair with React Hook
  Form (the project's form stack). Don't scatter loose `<Label>` + `<Input>` + manual error `<p>`.
- **Sets of options → `ToggleGroup`** (or `RadioGroup` for single-choice form fields), not a row of
  hand-managed buttons.
- **Toasts → `Sonner`** (`toast()` from `sonner`). The legacy `Toast` component is deprecated; use
  Sonner for all notifications.
- **Icons → the project's configured icon library** (check `info --json`; default is `lucide-react`).
  Don't mix icon sets.
- **Class merging → `cn()`** from `@/lib/utils` for every conditional/merged className. Never
  string-concatenate Tailwind classes.
- **Variants → the component's own `variant`/`size` props** (e.g. `<Button variant="outline">`),
  not bespoke className overrides that fight the design system.
- **Imports → the project alias**: `import { Button } from "@/components/ui/button"`.
- **Don't edit `src/components/ui/*` by hand** unless intentionally customizing a primitive; those
  are CLI-owned. Re-running `add` with `--overwrite` regenerates them.

## Theme rules

The theme is defined as OKLCH CSS variables in `src/index.css` (mirrored in `assets/index.css`):
`:root` for light, `.dark` for dark. The primary color is a vivid lime/chartreuse green.

- Style with **semantic tokens only**: `bg-background`, `text-foreground`, `bg-card`, `bg-primary`,
  `text-primary-foreground`, `bg-muted`, `text-muted-foreground`, `bg-accent`, `border-border`,
  `border-input`, `ring-ring`, `bg-destructive`, and the `sidebar-*` / `chart-*` tokens.
- **Never** introduce raw hex/rgb/oklch values in components or invent new ad-hoc CSS variables.
- Radius scales from `--radius`; use `rounded-md` / `rounded-lg` etc.
- To change the palette, edit the theme variables (or re-run
  `npx shadcn@latest apply b27JkRsW --only theme`) — never recolor components individually.
- Every screen must read correctly in both light and dark mode.

## First-time setup (only if `components.json` is absent)

This project initializes from the saved preset:

```bash
npx shadcn@latest init --preset b27JkRsW --template vite
```

This installs deps, adds the `cn` util, writes `components.json`, and configures the Tailwind v4
theme + CSS variables (`@import "tailwindcss"`, `tw-animate-css`, `@import "shadcn/tailwind.css"`).
Confirm the `@/*` alias exists in `tsconfig.json`, `tsconfig.app.json`, and `vite.config.ts`, and
that `src/index.css` is imported in `src/main.tsx`. Then add components as needed.

## Reference files

- `references/components.md` — full component catalog (radix base) + per-component install command,
  plus which composite patterns (Combobox, Date Picker, Data Table) are built from multiple parts.
- `references/composition.md` — detailed patterns: forms with Field/FieldGroup + React Hook Form,
  dialogs, command palette, sidebar layout, data tables, empty states, dark-mode toggle.
- `assets/index.css` — the canonical theme tokens (preset `b27JkRsW`).

## Optional: pair with shadcn's official skill + MCP

shadcn ships a first-party skill that injects live project context (`shadcn info --json`) on every
interaction. It complements this project skill and is worth installing:

```bash
npx shadcn@latest mcp        # optional: wire up the registry MCP server
pnpm dlx skills add shadcn/ui # official skill from skills.sh
```

This project skill carries the *project-specific* rules (shadcn-only, the `b27JkRsW` theme, the
local conventions); the official skill keeps the *general* shadcn knowledge current.
