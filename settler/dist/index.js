"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.mkVersionedCodec = void 0;

var NEA = _interopRequireWildcard(require("fp-ts/lib/NonEmptyArray"));

var E = _interopRequireWildcard(require("fp-ts/lib/Either"));

var _pipeable = require("fp-ts/lib/pipeable");

var io = _interopRequireWildcard(require("io-ts"));

var _function = require("fp-ts/lib/function");

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

const mkVersionedCodec = _versions => _migrations => {
  const versions = _versions; // Help TS not run into infinite recursion while calculating types.

  const migrations = (0, _function.unsafeCoerce)(_migrations);
  const taggedUnion = versions.length === 1 ? io.strict({
    version: io.literal(versions[0].version),
    data: versions[0].codec
  }) : io.union( // Convince type-checker that versions has at least 2 elements.
  (0, _function.unsafeCoerce)(versions.map(({
    version,
    codec
  }) => io.strict({
    version: io.literal(version),
    data: codec
  }))));
  return new io.Type("Versioned", taggedUnion.is, (input, context) => (0, _pipeable.pipe)(taggedUnion.validate(input, context), E.chain(t => {
    const versionIndex = versions.findIndex(({
      version
    }) => t.version === version);
    return (0, _function.unsafeCoerce)(migrations.slice(versionIndex).reduce((acc, fn, index) => {
      const prevIndex = versionIndex + index;
      const prev = versions[prevIndex];
      const next = versions[prevIndex + 1];
      const migrationIdentity = `migrate(${prev.version}, ${next.version})`;
      const codec = next.codec;
      return codec ? (0, _pipeable.pipe)(acc, E.chain(val => codec.validate(fn(val), io.appendContext(context, migrationIdentity, codec)))) : (0, _pipeable.pipe)(acc, E.map(fn));
    }, E.right(t.data)));
  })), data => {
    const current = NEA.last((0, _function.unsafeCoerce)(versions));
    return {
      version: current.version,
      data: current.codec.encode(data)
    };
  });
};

exports.mkVersionedCodec = mkVersionedCodec;