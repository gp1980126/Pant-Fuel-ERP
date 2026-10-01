# StationMitra Android + Smart AI

This isolated branch is the foundation for the Android-first + Smart AI product.

Important:
- Existing accounting logic remains authoritative.
- Smart AI is read-only by default.
- Financial-year and station/pump scope are mandatory context.
- Production secrets are excluded.
- Production Cloud data is not intentionally changed by this branch.

Next implementation stages:
1. Add mobile shell/navigation around existing StationMitra modules.
2. Connect SmartAiPanel to an authorized read-only analytics service.
3. Add AI explanations for Density/JUMP/stock/credit alerts.
4. Add installable Android/PWA packaging and offline sync indicators.
5. Run static regression + build before release.
