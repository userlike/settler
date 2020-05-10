import * as NEA from "fp-ts/lib/NonEmptyArray";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/pipeable";
import * as io from "io-ts";
import { L } from "ts-toolbelt";
import { unsafeCoerce } from "fp-ts/lib/function";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Versioned<V extends string = string, T = any> {
  version: V;
  codec: io.Type<T>;
}

type Versions = readonly [Versioned, ...(readonly Versioned[])];

type GetCurrent<V extends Versions> = L.Last<V>;
type GetCodec<V extends Versioned> = V["codec"];
type GetVersion<V extends Versioned> = V["version"];
type GetCodecType<T extends Versioned> = io.TypeOf<T["codec"]>;

type ZipVersions<V extends Versions> = L.Pop<L.Zip<V, L.Tail<V>>>;
type Index<L, K> = K extends keyof L ? L[K] : never;
type CastTo<V> = V extends Versioned ? V : never;

export type DecodeType<V extends Versions> = GetCodecType<GetCurrent<V>>;
export type EncodeType<V extends Versions> = Foreign<
  GetVersion<GetCurrent<V>>,
  io.OutputOf<GetCodec<GetCurrent<V>>>
>;
type MigrationFn<A, B> = (a: A) => B;

type MigrationsFromZip<V extends ZipVersions<Versions>> = {
  [I in keyof V]: MigrationFn<
    GetCodecType<CastTo<Index<Extract<V[I], V[number]>, 0>>>,
    GetCodecType<CastTo<Index<Extract<V[I], V[number]>, 1>>>
  >;
};

export type Migrations<V extends Versions> = MigrationsFromZip<ZipVersions<V>>;

type Foreign<Version extends string = string, T = unknown> = {
  version: Version;
  data: T;
};

type VersionedCodec<V extends Versions> = io.Type<DecodeType<V>, EncodeType<V>>;

export const mkVersionedCodec = <V extends Versions>(_versions: V) => (
  _migrations: Migrations<V>
): VersionedCodec<V> => {
  const versions = _versions;
  // Help TS not run into infinite recursion while calculating types.
  const migrations: MigrationFn<unknown, unknown>[] = unsafeCoerce(_migrations);

  const taggedUnion: io.Type<Foreign> =
    versions.length === 1
      ? io.strict({
          version: io.literal(versions[0].version),
          data: versions[0].codec,
        })
      : io.union(
          // Convince type-checker that versions has at least 2 elements.
          unsafeCoerce<
            unknown,
            [io.Type<Foreign>, io.Type<Foreign>, ...io.Type<Foreign>[]]
          >(
            versions.map(({ version, codec }) =>
              io.strict({
                version: io.literal(version),
                data: codec,
              })
            )
          )
        );

  return new io.Type(
    "Versioned",
    taggedUnion.is,
    (input: unknown, context: io.Context) =>
      pipe(
        taggedUnion.validate(input, context),
        E.chain((t) => {
          const versionIndex = versions.findIndex(
            ({ version }) => t.version === version
          );
          return unsafeCoerce(
            migrations
              .slice(versionIndex)
              .reduce(
                (
                  acc: io.Validation<unknown>,
                  fn: MigrationFn<unknown, unknown>,
                  index: number
                ) => {
                  const prevIndex = versionIndex + index;
                  const prev = versions[prevIndex];
                  const next = versions[prevIndex + 1];
                  const migrationIdentity = `migrate(${prev.version}, ${next.version})`;
                  const codec = next.codec;
                  return codec
                    ? pipe(
                        acc,
                        E.chain((val) =>
                          codec.validate(
                            fn(val),
                            io.appendContext(context, migrationIdentity, codec)
                          )
                        )
                      )
                    : pipe(acc, E.map(fn));
                },
                E.right(t.data)
              )
          );
        })
      ),
    (data: GetCodecType<GetCurrent<Versions>>) => {
      const current = NEA.last(
        unsafeCoerce<V, NEA.NonEmptyArray<Versioned>>(versions)
      );
      return {
        version: current.version,
        data: current.codec.encode(data),
      };
    }
  );
};
