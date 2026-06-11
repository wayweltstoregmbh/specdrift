## SpecDrift Report

❌ **Status: FAIL** — coverage 67.5%

Required: 40 · Covered: 26 · Missing: 12 · Distorted: 1 · Waived: 0 · Additions: 0

### Drift

| Claim | Verdict | Source | Requirement | Reason |
| --- | --- | --- | --- | --- |
| claim_016 | missing | spec.md:29 | Secondary action: "Status prüfen". | secondary action "Status prüfen" was not implemented |
| claim_027 | missing | spec.md:43 | Button contrast must be readable in desktop and mobile screenshots. | browser evidence not produced in this static validation run |
| claim_029 | missing | spec.md:45 | Desktop and mobile layouts must both be tested with browser screenshots. | browser evidence not produced in this static validation run |
| claim_030 | missing | spec.md:49 | A WordPress test page containing the shortcode must exist or be created by th... | browser evidence not produced in this static validation run |
| claim_031 | missing | spec.md:50 | Playwright/browser evidence is mandatory. | browser evidence not produced in this static validation run |
| claim_033 | missing | spec.md:52 | shortcode renders the current plugin, not a sibling plugin; | browser evidence not produced in this static validation run |
| claim_034 | missing | spec.md:53 | theme chrome is hidden; | browser evidence not produced in this static validation run |
| claim_035 | missing | spec.md:54 | form fields are visible and usable; | browser evidence not produced in this static validation run |
| claim_036 | missing | spec.md:55 | submit keeps the same browser page without reload; | browser evidence not produced in this static validation run |
| claim_037 | missing | spec.md:56 | success/status UI appears after submit; | browser evidence not produced in this static validation run |
| claim_039 | missing | spec.md:58 | desktop and mobile screenshots are captured; | browser evidence not produced in this static validation run |
| claim_040 | missing | spec.md:59 | console errors and failed browser requests are blocking. | browser evidence not produced in this static validation run |
| claim_038 | distorted | spec.md:57 | secondary actions are visible and readable; | only one of two secondary actions exists; "Status prüfen" is absent |

**Blocking:** 12 requirement(s) missing from the implementation

**Blocking:** 1 requirement(s) implemented differently than specified
