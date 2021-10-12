## ⛺ Settler

`settler` is a typesafe migration utility to migrate data between versions, similar to database migrations.
Utilizes [io-ts](https://github.com/gcanti/io-ts) codecs.

This is aimed at having migration capability for persisted, versioned and JSON encoded data.

### Install

```sh
yarn add @userlike/settler
```

### Usage

- Only forward migrations are supported.
- `settler` enforces correct number of migrations and correct types for migration functions.
- Migrations are based on `io-ts`. The migrations object produced by `mkVersionedCodec` is actually an io-ts codec.

  - `migrations.decode` decodes versioned data and applies migration functions to migrate it to the last version.
  - `migrations.encode` encodes data by wrapping it with an object and embedding version info; which can later be decoded, and potentially migrated.
  - `decode(encode(myData))` is equal to `myData`.
  - Typical use case:

    ```ts
    // persist
    localStorage.setItem("myData", JSON.stringify(migrations.encode(myData)));

    // restore
    migrations.decode(JSON.parse(localStorage.getItem("myData")));
    ```

#### Further examples

```ts
import { mkVersionedCodec } from "@userlike/settler";
import * as io from "io-ts";
import { right } from "fp-ts/lib/Either";

// Migration definitions for 3 versions.
const migrations = mkVersionedCodec([
  { version: "1", codec: io.strict({ isOpened: io.boolean }) },
  {
    version: "2",
    codec: io.strict({ isOpened: io.boolean, ids: io.array(io.number) }),
  },
  { version: "3", codec: io.strict({ ids: io.array(io.number) }) },
])([
  // from v1 to v2
  ({ isOpened }) => ({ isOpened, ids: [] }),
  // from v2 to v3
  ({ ids }) => ({ ids }),
]);

// =========================

// Migrating from version 1
expect(
  migrations.decode({
    version: "1",
    data: {
      isOpened: true,
    }
  })
).toEqual(right({ ids: [] }));

// Migrating from version 2
expect(
  migrations.decode({
    version: "2",
    data: {
      isOpened: true,
      ids: [1, 2, 3],
    },
  })
).toEqual(right({ ids: [1, 2, 3] }));

// Migrating from version 3, noop
expect(
  migrations.decode({
    version: "3",
    data: {
      ids: [1, 2, 3],
    },
  })
).toEqual(right({ ids: [1, 2, 3] }));

// Encoding versioned data
// Can use this to persist
expect(
  migrations.encode({
    ids: [1, 2, 3],
  })
).toEqual({
  version: "3",
  data: {
    ids: [1, 2, 3],
  },
});
```

See [tests](./settler/src/index.test.ts).
