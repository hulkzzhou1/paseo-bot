# Forward version admission

2026-10-28. Issue #10. User explicitly requested allowing later Paseo versions after App 0.14.0-beta.1 rejected the exact 0.13.2 requirement. Release v0.3.1 pins `73b81ff03f36bdd3ae75bf4f871daaa8bd9cf2df`.

The only runtime-affecting change is manifest `requirements.paseo: >=0.13.2`. Runtime source and all non-root dependency lock entries equal baseline `5578bbb`. Minimum-only ranges, including newer prereleases via their stable core, are documented in the [current public reference](https://paseo.sh/docs/plugins/reference#requirements). Future breaking APIs are not guaranteed compatible.

- RED: `node --import tsx --test tests/compatibility.test.ts` reproduced the user's exact 0.14.0-beta.1 rejection, exit1.
- GREEN: same focused command passed2/2, exit0. Public protocol validator checks baseline/newer beta/newer stable/future major admission and older version rejection.
- `npm test`:33/33, exit0 (50.4seconds); typecheck,lint,format:check and git diff --check exit0.
- Independent Standards and Spec reviews caught two unintended transitive lock version edits during the root version bump. Restored every non-root entry, verified identical to baseline, and both re-reviews reported zero outstanding findings.
- Fresh remote exact-SHA install in an empty isolated0.13.2 daemon passed the locked production build and bootstrap. Plugin running status, installation revision and checkout HEAD matched. The installed manifest passed the0.14.0-beta.1 app gate through the public validator.
- User-authorized local update completed, exit0. A separate public plugin listing confirmed enabled/running at the release pin; the installed manifest was `>=0.13.2` and independently passed the reported beta gate. No production restart, configuration change or test conversation.

No new browser screenshot or real Provider turn was required for this manifest-only runtime change; prior0.13.2 UI/Provider acceptance remains historical. The user's0.14.0-beta.1 native App was not directly exercised, and no claim of full beta runtime compatibility is made. Native mobile/Electron acceptance remains untested.

Git release v0.3.1 is published. Community request [#1338](https://github.com/getpaseo/plugins/issues/1338) and [PR #1339](https://github.com/getpaseo/plugins/pull/1339) propose only the two record commit fields, preserving timestamps for reviewer finalization. Trusted registry policy at `30ac30e` was read;172 registry tests passed, online validation reported400 well-formed records and one matching changed artifact, whitespace passed. No plugin code ran during registry preparation. Independent review/listing of0.3.1 remains pending. Actual deployed directory was verified at the approved0.3.0 pin `0966b7686859a4c6af0b8cd47332d49c12dd48b5`.
