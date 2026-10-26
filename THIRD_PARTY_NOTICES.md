# Third-party notices

Original Paseo Bot source is MIT licensed; see [LICENSE](LICENSE). Third-party components retain their own licenses.

| Component | Version | Copyright / license | Use |
| --- | --- | --- | --- |
| Paseo public client, server, plugin and protocol packages | 0.13.2 | Copyright 2025-present Mohamed Boudra; Apache-2.0, excluding third-party components | Public host contracts and UI; selected-home Node recovery helper |
| Zod | 4.4.3 | Copyright 2025 Colin McDonnell; MIT | RPC schemas, using the host-supplied runtime |
| React / React Native | Supplied by Paseo | Their respective upstream authors; MIT | Host-supplied component runtime, not redistributed in this source artifact |

The [Paseo 0.13.2 license](https://github.com/getpaseo/paseo/blob/v0.13.2/LICENSE) and [Zod license](https://github.com/colinhacks/zod/blob/v4.4.3/LICENSE) are reproduced in [licenses/](licenses/). The installed Paseo package manifests omit a license field; the attribution above comes from the actual upstream release license, not an inferred package license. This plugin composes public UI primitives and does not copy Paseo's private conversation implementation.

The public Git preparation step installs the exact production dependency tree in `package-lock.json`. Those dependencies and their transitive components retain their original package license files and notices under `node_modules`; the Bot MIT license does not relicense them. Development-only tooling and host-supplied runtimes are not bundled into the Git source artifact. The standalone recovery helper requires installed `@getpaseo/client` and `@getpaseo/server`; their licenses remain applicable when installed.
