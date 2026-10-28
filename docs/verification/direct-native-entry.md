# Direct native entry after local feedback

The user explicitly removed both the first source-selection page and the later Open Team workspace intermediate page. This supersedes the entry flow in #15/#16 without changing existing preset resolution, notes, deletion fallback, permission checks or history ownership.

Normal entry now calls only the existing `open-workspace` RPC and public native navigation. It never invokes source setup or writes presets. First use without a dedicated association uses valid native settings and one public default rule set; previously configured dedicated presets continue to work. `prepare-coordinator` remains a compatible explicit RPC, with its existing uncertainty safeguards. Errors retain recovery/history/retry controls. No new editor or alternative setup flow is introduced.

## Verification

Browser RED at `6fbf410`: after clicking Paseo Team, the native Agent action did not appear within 10 seconds because the intermediate page remained. GREEN after the client change: the same action opened the native New tab page directly, with neither the source chooser nor intermediate Open Team workspace button.

The public isolated-daemon native entry test additionally checks concurrent open, no Agent until sending, no profiles before/after, actual Provider runtime inputs and one public default rule set. Existing preset/lifecycle tests remain intact, including edited/empty notes, deletion, unknown association and lost acknowledgements.

Final revision, commands/exits, browser screenshots, independent review and installation result are recorded at delivery below.

## Scope limits

The initial native New tab screen and its Agent action belong to Paseo. The plugin uses supported workspace navigation and leaves native draft/tab restoration to the host. It does not create an empty Agent to force a chat route.

Native iOS/Android and Electron are not tested. The prior real-model coordination evidence remains applicable because the default rule text is unchanged. Preset array writes through the retained legacy setup RPC still lack cross-client CAS.
