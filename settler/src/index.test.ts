import { describe, it, test, expect } from "@jest/globals";
import { B } from "ts-toolbelt";

import * as E from "fp-ts/lib/Either";
import { identity, unsafeCoerce } from "fp-ts/lib/function";
import * as io from "io-ts";
import { reporter } from "io-ts-reporters";
import { mkVersionedCodec, DecodeType, EncodeType, Migrations } from "./index";

const versions = [
  { version: "1", codec: io.strict({ isOpened: io.boolean }) },
  {
    version: "2",
    codec: io.strict({ isOpened: io.boolean, ids: io.array(io.number) }),
  },
  { version: "3", codec: io.strict({ ids: io.array(io.number) }) },
] as const;

describe("types", () => {
  test("DecodeType = data type of current version", () => {
    type Result = DecodeType<typeof versions>;
    expectType<Result>((to) => to.equal<{ ids: number[] }>());
  });
  test("EncodeType = output type for current version", () => {
    type Result = EncodeType<typeof versions>;
    expectType<Result>((to) =>
      to.equal<{
        version: "3";
        data: { ids: number[] };
      }>()
    );
  });
  test("Migrations", () => {
    type Result = Migrations<typeof versions>;
    type Expected = [
      (a: { isOpened: boolean }) => { isOpened: boolean; ids: number[] },
      (a: { isOpened: boolean; ids: number[] }) => { ids: number[] }
    ];
    expectType<Result>((to) => to.equal<Expected>());
  });
  test("Empty migrations", () => {
    // eslint-disable-next-line @typescript-eslint/ban-types
    type Result = Migrations<[{ version: "1"; codec: io.Type<{}> }]>;
    expectType<Result>((to) => to.equal<[]>());
  });

  it("does not allow empty versions array", () => {
    type Versions = Parameters<typeof mkVersionedCodec>;
    expectType<Versions>((to) => to.notEqual<[]>());
  });

  type IsSame<T, I> = T extends I ? B.True : B.False;

  type Assertions<T> = {
    equal: <I>() => IsSame<T, I>;
    notEqual: <I>() => B.Not<IsSame<T, I>>;
  };

  function expectType<T>(
    _: (assertion: Assertions<T>) => B.True
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  ): void {}
});

describe("implementation", () => {
  const codec = mkVersionedCodec(versions)([
    ({ isOpened }) => ({ isOpened, ids: [] }),
    identity,
  ]);
  it("decodes last version", () => {
    const input = { version: "3", data: { ids: [1, 2, 3] } };
    expect(codec.decode(input)).toEqual(
      E.right({
        ids: [1, 2, 3],
      })
    );
  });
  it("decodes middle version", () => {
    const input = { version: "2", data: { isOpened: true, ids: [1, 2, 3] } };
    expect(codec.decode(input)).toEqual(
      E.right({
        ids: [1, 2, 3],
      })
    );
  });
  it("decodes first version", () => {
    const input = { version: "1", data: { isOpened: true } };
    expect(codec.decode(input)).toEqual(
      E.right({
        ids: [],
      })
    );
  });
  it("encodes last version", () => {
    expect(
      codec.encode({
        ids: [1, 2, 3],
      })
    ).toEqual({
      version: "3",
      data: {
        ids: [1, 2, 3],
      },
    });
  });
  it("works when there is one version only", () => {
    const codec = mkVersionedCodec([
      { version: "1", codec: io.type({ foo: io.string }) },
    ])([]);

    const input = { version: "1", data: { foo: "foo" } };
    expect(codec.decode(input)).toEqual(
      E.right({
        foo: "foo",
      })
    );
    expect(codec.encode({ foo: "bar" })).toEqual({
      version: "1",
      data: {
        foo: "bar",
      },
    });
  });
});

describe("errors", () => {
  it("reports invalid input", () => {
    const codec = mkVersionedCodec(versions)([
      ({ isOpened }) => ({ isOpened, ids: [] }),
      identity,
    ]);
    const input = { version: "1", data: { ids: [1, 2, 3] } };
    expect(reporter(codec.decode(input))).toEqual([
      "Expecting boolean at 0.data.isOpened but instead got: undefined",
    ]);
  });

  it("reports invalid migration implementation", () => {
    const codec = mkVersionedCodec(versions)([
      ({ isOpened }) => ({ isOpened, ids: unsafeCoerce(null) }),
      identity,
    ]);
    const input = { version: "1", data: { isOpened: true } };
    expect(reporter(codec.decode(input))).toEqual([
      "Expecting Array<number> at migrate(1, 2).ids but instead got: null",
    ]);
  });

  it("reports invalid migration implementation", () => {
    const codec = mkVersionedCodec(versions)([
      ({ isOpened }) => ({ isOpened, ids: [] }),
      () => unsafeCoerce({ isOpened: true, ids: "not found" }),
    ]);
    const input = { version: "1", data: { isOpened: true } };
    expect(reporter(codec.decode(input))).toEqual([
      'Expecting Array<number> at migrate(2, 3).ids but instead got: "not found"',
    ]);
  });

  it("reports input error when there is one version only", () => {
    const codec = mkVersionedCodec([
      { version: "1", codec: io.type({ foo: io.string }) },
    ])([]);

    const input = { version: "1", data: { foo: 99 } };
    expect(reporter(codec.decode(input))).toEqual([
      "Expecting string at data.foo but instead got: 99",
    ]);
  });
});
