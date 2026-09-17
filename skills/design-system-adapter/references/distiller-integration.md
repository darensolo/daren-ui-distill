# UI Distiller integration

Read this optional reference only when the user explicitly asks to adapt an existing compatible asset or Source Replica through UI Distiller.

- Input is an existing AssetPackage/Source Replica plus a versioned Daren target reference. Do not recapture or re-run source replication.
- Create a physically separate adapted AssetPackage and retain the source artifact unchanged.
- Use only existing Daren token names. Missing mappings become typed gaps; do not invent tokens or write `daren-design` truth.
- Audit the adapted revision against its target and allowed-delta contexts. A missing context or stale report cannot pass.
- Adaptation itself never writes the shared library or site. When the user also asks for delivery, hand the validated adapted AssetPackage to `design-asset-registrar`; a later site projection is owned separately by `design-asset-publisher` and requires a RegistrationReceipt.

The existing Govern/Fit/manual workflows remain read-only or proposal-only according to their current rules. Merely reviewing UI or producing a Fit Packet never creates an adaptation job.
