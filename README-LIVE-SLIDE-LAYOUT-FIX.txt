SARGAMIYA LIVE — SLIDE LAYOUT FIX

This update repairs overflow and cropping seen in the five Live carousel slides.

Fixes:
- Constrains each slide's copy panel to its own column; text and feature cards no longer overlap the artwork.
- Reduces heading sizes responsively and uses the available column width.
- Limits schedule/result/highlight/announcement cards to their parent width.
- Uses contain framing for the illustration on desktop/tablet so NOVA and LUMI are not cut off by cover-cropping.
- Adds compact tablet rules and mobile width safeguards.
- No database schema or environment-variable changes.

Patch files:
- app/globals.css

Full website archive is based on Sargamiya Website Step 6 (schedule date fix), preserving the current five-slide Live page and admin schedule workflow.
