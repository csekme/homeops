# Composition patterns

Detailed, project-correct patterns. Always confirm the current API with
`npx shadcn@latest docs <component> --base radix` before coding — these sketches show *structure
and intent*, not frozen API surfaces.

## Forms — Field / FieldGroup (+ React Hook Form)

shadcn forms are composed from `Field` parts inside a `FieldGroup`. This gives consistent spacing,
labels, descriptions, and error slots. Do **not** assemble forms from loose `Label` + `Input` +
manual error paragraphs.

Install: `npx shadcn@latest add field input button` (and `add form` if using the RHF wrapper).

Shape:

```tsx
<FieldGroup>
  <Field>
    <FieldLabel htmlFor="email">Email</FieldLabel>
    <Input id="email" type="email" placeholder="you@example.com" />
    <FieldDescription>We'll never share it.</FieldDescription>
    <FieldError /> {/* renders validation message when present */}
  </Field>
  <Field>
    <FieldLabel htmlFor="password">Password</FieldLabel>
    <Input id="password" type="password" />
  </Field>
  <Button type="submit">Sign in</Button>
</FieldGroup>
```

For validated forms, drive state with **React Hook Form** (the project's form library) and surface
errors through `FieldError`. See `npx shadcn@latest docs field` and the Forms docs.

## Single vs multiple choice

- Single choice in a form → **Radio Group**:
  ```tsx
  <RadioGroup defaultValue="card">
    <Field orientation="horizontal">
      <RadioGroupItem value="card" id="card" />
      <FieldLabel htmlFor="card">Card</FieldLabel>
    </Field>
  </RadioGroup>
  ```
- A set of independent/segmented options → **Toggle Group** (`type="single"` or `"multiple"`):
  ```tsx
  <ToggleGroup type="single" defaultValue="bold">
    <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
    <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
  </ToggleGroup>
  ```

## Dialog vs Alert Dialog

- General modal content → **Dialog**.
- Confirming a destructive/irreversible action → **Alert Dialog** (has explicit Action/Cancel).

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild><Button variant="destructive">Delete</Button></AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
      <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

## Toasts — Sonner

`Toast` is deprecated. Use **Sonner**: mount `<Toaster />` once near the app root, then call
`toast()` anywhere.

```tsx
// App root
import { Toaster } from "@/components/ui/sonner"
// ...
<Toaster richColors />

// Anywhere
import { toast } from "sonner"
toast.success("Saved")
```

## Command palette (⌘K)

Compose **Command** inside a **Dialog** (`CommandDialog`) for a global palette. See
`npx shadcn@latest docs command`.

## App layout — Sidebar

Use the **Sidebar** component for app chrome; it's wired to the `sidebar-*` theme tokens. Wrap the
app in `SidebarProvider`, place `<AppSidebar />` and a `SidebarTrigger`, and the rest of the page in
`SidebarInset`. See `npx shadcn@latest docs sidebar`.

## Data tables

Compose **Table** with **TanStack Table** (`@tanstack/react-table`) for sorting, filtering, row
selection, and pagination. Follow the Data Table doc end-to-end rather than partial-wiring:
`npx shadcn@latest docs data-table`.

## Empty states

Use **Empty** for "no results / nothing here yet" rather than ad-hoc centered text:

```tsx
<Empty>
  <EmptyHeader>
    <EmptyTitle>No projects</EmptyTitle>
    <EmptyDescription>Create your first project to get started.</EmptyDescription>
  </EmptyHeader>
  <EmptyContent><Button>New project</Button></EmptyContent>
</Empty>
```

## Dark mode toggle

The theme already defines `.dark`. Toggle by adding/removing the `dark` class on `<html>` (a small
theme provider with `localStorage` persistence is the standard pattern; see
`npx shadcn@latest docs` / the Dark Mode docs). Never duplicate color values — both modes read from
the same semantic tokens.

## Styling discipline

- Conditional classes → `cn()` from `@/lib/utils`.
- Reach for component `variant`/`size` props before custom classNames.
- Spacing/typography via Tailwind utilities; colors/radii via semantic tokens only.
- Keep custom composed components in `src/components/`; leave `src/components/ui/*` to the CLI.
