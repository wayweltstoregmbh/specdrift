# MVP Specification: Generic WordPress Intake Shortcode

## Product Goal

Build a small WordPress shortcode MVP that lets a visitor submit a generic intake request and immediately receive a visible reference number and next-step status without a page reload.

## Format

- WordPress plugin.
- Shortcode: `[example_intake]`.
- The shortcode app must render as a focused fullscreen application surface.
- Theme header, footer, page title, and common block-theme chrome must be hidden while the app is active.
- No build pipeline, no external APIs, no database persistence for the MVP.

## Target Users

- Visitor: submits a request and wants immediate confirmation.
- Internal reviewer: only represented by the status copy in this MVP, no admin UI required.

## Required UI

- Hero area with product label "Example Product" and title "Intake Request".
- Form fields:
  - Name.
  - E-Mail.
  - Kategorie with at least three options.
  - Anliegen as multiline text.
- Primary action: "Einschätzung anfordern".
- Secondary action: "Status prüfen".
- Secondary detail action: "Details anzeigen".
- After submit, update the same page in-place with:
  - generated reference number,
  - status "Browser-Test aktiv",
  - clear next-step text,
  - visible success message.
- The interaction must not reload the page.

## UX And Visual Requirements

- Premium, calm interface, not a generic Bootstrap look.
- Define design tokens for colors, radius, spacing, and typography at one functional location.
- Buttons in the same local action group must use visually compatible height, font family, font size, and alignment.
- Button contrast must be readable in desktop and mobile screenshots.
- Different text sizes are allowed when they create hierarchy, such as hero title versus explanatory copy.
- Desktop and mobile layouts must both be tested with browser screenshots.

## Practical Browser Proof

- A WordPress test page containing the shortcode must exist or be created by the test harness.
- Playwright/browser evidence is mandatory.
- Required checks:
  - shortcode renders the current plugin, not a sibling plugin;
  - theme chrome is hidden;
  - form fields are visible and usable;
  - submit keeps the same browser page without reload;
  - success/status UI appears after submit;
  - secondary actions are visible and readable;
  - desktop and mobile screenshots are captured;
  - console errors and failed browser requests are blocking.

## Non-Goals

- No real email sending.
- No real ticket backend.
- No login.
- No external API.
- No admin dashboard.
