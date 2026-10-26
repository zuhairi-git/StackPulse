# StackPulse design system

Import reusable UI from `src/design-system`. The app and its **Design system** navigation section consume the same components. Gallery interactions use local demo state and never write connections or credentials.

## Foundations

`tokens.css` defines semantic color, spacing, and radius variables. `styles.css` owns the existing app theme and responsive rules; `gallery.css` only lays out the catalog. `src/style.css` is the stylesheet entry point. Use semantic `--ds-*` variables when extending the system.

## Components

- Actions: `Button` with primary, secondary, text, icon, and connect variants; `Switch`.
- Forms: `Input`, `SearchField`, keyboard-accessible `Dropdown`.
- Feedback: `Badge`, `Dot`, `Notice`, `InfoBox`, `EmptyState`.
- Layout: `Panel`, `PageHeading`, `SectionHeading`, `SettingRow`, `Tabs`.
- Data: `MetricGroup`, `Metric`, `ProviderGrid`, `ProviderCard`, `ProviderCardHeader`, `ProviderCardBody`, `ProviderCardFooter`, `TableContainer`, `DataTable`.
- Overlays: `Dialog`, `DialogContent`, `DialogHeading`, `ProviderOption`.
- Assets: `Icon`, `Logo`.

Native element props, accessibility attributes, event handlers, and React 19 refs pass through to the underlying element. Layout components have their named CSS class by default. A supplied `className` overrides that default, so include the base class when adding modifiers (for example `panel browser-info`). Button `className` also overrides its variant, preserving existing contextual navigation styles.

`Dialog` uses the native dialog element. Call `showModal()` on its ref to open it and `close()` to close it. Product dialogs keep asynchronous save, validation, and destructive-action logic in their feature components.

## Adding components

Export new reusable UI from `index.ts`, use it in the relevant feature, and add an interactive example in `Gallery.tsx`. Keep provider requests, storage, authentication, and account mutation outside presentation components. Icon-only actions need an accessible label, forms need labels, and switches need an accessible name and checked state.

Run `npm run check` and `npm run build` before shipping changes.

## Icon styles

Interface icons use the locally supplied Font Awesome kit, with Duotone Thin as the default. Provider brand logos retain their brand artwork. Change **Settings → Appearance → Icon style**, or the selector in the gallery, to update every interface icon immediately. The preference is stored locally and synchronized between open tabs.

`IconStyle.tsx` registers supported styles and discovers the matching `.woff2` assets during the build. Missing styles are excluded from the selector and unavailable saved preferences fall back to Thin. To enable Sharp Duotone Solid, add `fa-sharp-duotone-solid-900.woff2` to `fa-kit-60396e54cd-web/webfonts` and rebuild (or restart the development server). The selector then offers the new style without component changes. Other supported font filenames are listed in the same registry. Add future styles there with a stable value, display label, filename, and weight.

Fonts are bundled locally, cached with the offline app shell, and require no remote kit script or CDN requests.
