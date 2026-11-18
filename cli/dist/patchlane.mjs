#!/usr/bin/env node

// cli/patchlane.ts
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";

// src/engine/types.ts
var SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"];
function severityRank(s) {
  return SEVERITY_ORDER.indexOf(s);
}
var AREA_LABEL = {
  api: "Authorization and data",
  auth: "Authentication",
  docs: "Documentation",
  inventory: "Inventory",
  server: "Server configuration",
  token: "Tokens",
  release: "Release",
  agent: "AI agents"
};
var FRAMEWORK_LABEL = {
  express: "Express (Node.js)",
  fastapi: "FastAPI (Python)",
  django: "Django REST Framework",
  laravel: "Laravel (PHP)",
  spring: "Spring Boot (Java)"
};

// src/engine/refs.ts
var API_TOP10 = {
  API1: "API1:2023 Broken Object Level Authorization",
  API2: "API2:2023 Broken Authentication",
  API3: "API3:2023 Broken Object Property Level Authorization",
  API4: "API4:2023 Unrestricted Resource Consumption",
  API5: "API5:2023 Broken Function Level Authorization",
  API6: "API6:2023 Unrestricted Access to Sensitive Business Flows",
  API7: "API7:2023 Server Side Request Forgery",
  API8: "API8:2023 Security Misconfiguration",
  API9: "API9:2023 Improper Inventory Management",
  API10: "API10:2023 Unsafe Consumption of APIs"
};
var LLM_RISK = {
  injection: "OWASP LLM: Prompt injection",
  agency: "OWASP LLM: Excessive agency",
  output: "OWASP LLM: Improper output handling",
  disclosure: "OWASP LLM: Sensitive information disclosure",
  hiddenContext: "OWASP LLM: System prompt leakage",
  supply: "OWASP LLM: Supply chain",
  poisoning: "OWASP LLM: Data and model poisoning"
};

// node_modules/js-yaml/dist/js-yaml.mjs
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var jsYaml = {};
var loader = {};
var common = {};
var hasRequiredCommon;
function requireCommon() {
  if (hasRequiredCommon) return common;
  hasRequiredCommon = 1;
  function isNothing(subject) {
    return typeof subject === "undefined" || subject === null;
  }
  function isObject(subject) {
    return typeof subject === "object" && subject !== null;
  }
  function toArray(sequence) {
    if (Array.isArray(sequence)) return sequence;
    else if (isNothing(sequence)) return [];
    return [sequence];
  }
  function extend(target, source) {
    if (source) {
      const sourceKeys = Object.keys(source);
      for (let index = 0, length = sourceKeys.length; index < length; index += 1) {
        const key = sourceKeys[index];
        target[key] = source[key];
      }
    }
    return target;
  }
  function repeat(string, count) {
    let result = "";
    for (let cycle = 0; cycle < count; cycle += 1) {
      result += string;
    }
    return result;
  }
  function isNegativeZero(number) {
    return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
  }
  common.isNothing = isNothing;
  common.isObject = isObject;
  common.toArray = toArray;
  common.repeat = repeat;
  common.isNegativeZero = isNegativeZero;
  common.extend = extend;
  return common;
}
var exception;
var hasRequiredException;
function requireException() {
  if (hasRequiredException) return exception;
  hasRequiredException = 1;
  function formatError(exception2, compact) {
    let where = "";
    const message = exception2.reason || "(unknown reason)";
    if (!exception2.mark) return message;
    if (exception2.mark.name) {
      where += 'in "' + exception2.mark.name + '" ';
    }
    where += "(" + (exception2.mark.line + 1) + ":" + (exception2.mark.column + 1) + ")";
    if (!compact && exception2.mark.snippet) {
      where += "\n\n" + exception2.mark.snippet;
    }
    return message + " " + where;
  }
  function YAMLException2(reason, mark) {
    Error.call(this);
    this.name = "YAMLException";
    this.reason = reason;
    this.mark = mark;
    this.message = formatError(this, false);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error().stack || "";
    }
  }
  YAMLException2.prototype = Object.create(Error.prototype);
  YAMLException2.prototype.constructor = YAMLException2;
  YAMLException2.prototype.toString = function toString(compact) {
    return this.name + ": " + formatError(this, compact);
  };
  exception = YAMLException2;
  return exception;
}
var snippet;
var hasRequiredSnippet;
function requireSnippet() {
  if (hasRequiredSnippet) return snippet;
  hasRequiredSnippet = 1;
  const common2 = requireCommon();
  function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
    let head = "";
    let tail = "";
    const maxHalfLength = Math.floor(maxLineLength / 2) - 1;
    if (position - lineStart > maxHalfLength) {
      head = " ... ";
      lineStart = position - maxHalfLength + head.length;
    }
    if (lineEnd - position > maxHalfLength) {
      tail = " ...";
      lineEnd = position + maxHalfLength - tail.length;
    }
    return {
      str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, "\u2192") + tail,
      pos: position - lineStart + head.length
      // relative position
    };
  }
  function padStart(string, max) {
    return common2.repeat(" ", max - string.length) + string;
  }
  function makeSnippet(mark, options) {
    options = Object.create(options || null);
    if (!mark.buffer) return null;
    if (!options.maxLength) options.maxLength = 79;
    if (typeof options.indent !== "number") options.indent = 1;
    if (typeof options.linesBefore !== "number") options.linesBefore = 3;
    if (typeof options.linesAfter !== "number") options.linesAfter = 2;
    const re = /\r?\n|\r|\0/g;
    const lineStarts = [0];
    const lineEnds = [];
    let match;
    let foundLineNo = -1;
    while (match = re.exec(mark.buffer)) {
      lineEnds.push(match.index);
      lineStarts.push(match.index + match[0].length);
      if (mark.position <= match.index && foundLineNo < 0) {
        foundLineNo = lineStarts.length - 2;
      }
    }
    if (foundLineNo < 0) foundLineNo = lineStarts.length - 1;
    let result = "";
    const lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
    const maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);
    for (let i = 1; i <= options.linesBefore; i++) {
      if (foundLineNo - i < 0) break;
      const line2 = getLine(
        mark.buffer,
        lineStarts[foundLineNo - i],
        lineEnds[foundLineNo - i],
        mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]),
        maxLineLength
      );
      result = common2.repeat(" ", options.indent) + padStart((mark.line - i + 1).toString(), lineNoLength) + " | " + line2.str + "\n" + result;
    }
    const line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
    result += common2.repeat(" ", options.indent) + padStart((mark.line + 1).toString(), lineNoLength) + " | " + line.str + "\n";
    result += common2.repeat("-", options.indent + lineNoLength + 3 + line.pos) + "^\n";
    for (let i = 1; i <= options.linesAfter; i++) {
      if (foundLineNo + i >= lineEnds.length) break;
      const line2 = getLine(
        mark.buffer,
        lineStarts[foundLineNo + i],
        lineEnds[foundLineNo + i],
        mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]),
        maxLineLength
      );
      result += common2.repeat(" ", options.indent) + padStart((mark.line + i + 1).toString(), lineNoLength) + " | " + line2.str + "\n";
    }
    return result.replace(/\n$/, "");
  }
  snippet = makeSnippet;
  return snippet;
}
var type;
var hasRequiredType;
function requireType() {
  if (hasRequiredType) return type;
  hasRequiredType = 1;
  const YAMLException2 = requireException();
  const TYPE_CONSTRUCTOR_OPTIONS = [
    "kind",
    "multi",
    "resolve",
    "construct",
    "instanceOf",
    "predicate",
    "represent",
    "representName",
    "defaultStyle",
    "styleAliases"
  ];
  const YAML_NODE_KINDS = [
    "scalar",
    "sequence",
    "mapping"
  ];
  function compileStyleAliases(map2) {
    const result = {};
    if (map2 !== null) {
      Object.keys(map2).forEach(function(style) {
        map2[style].forEach(function(alias) {
          result[String(alias)] = style;
        });
      });
    }
    return result;
  }
  function Type2(tag, options) {
    options = options || {};
    Object.keys(options).forEach(function(name) {
      if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
        throw new YAMLException2('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.');
      }
    });
    this.options = options;
    this.tag = tag;
    this.kind = options["kind"] || null;
    this.resolve = options["resolve"] || function() {
      return true;
    };
    this.construct = options["construct"] || function(data) {
      return data;
    };
    this.instanceOf = options["instanceOf"] || null;
    this.predicate = options["predicate"] || null;
    this.represent = options["represent"] || null;
    this.representName = options["representName"] || null;
    this.defaultStyle = options["defaultStyle"] || null;
    this.multi = options["multi"] || false;
    this.styleAliases = compileStyleAliases(options["styleAliases"] || null);
    if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
      throw new YAMLException2('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
    }
  }
  type = Type2;
  return type;
}
var schema;
var hasRequiredSchema;
function requireSchema() {
  if (hasRequiredSchema) return schema;
  hasRequiredSchema = 1;
  const YAMLException2 = requireException();
  const Type2 = requireType();
  function compileList(schema2, name) {
    const result = [];
    schema2[name].forEach(function(currentType) {
      let newIndex = result.length;
      result.forEach(function(previousType, previousIndex) {
        if (previousType.tag === currentType.tag && previousType.kind === currentType.kind && previousType.multi === currentType.multi) {
          newIndex = previousIndex;
        }
      });
      result[newIndex] = currentType;
    });
    return result;
  }
  function compileMap() {
    const result = {
      scalar: {},
      sequence: {},
      mapping: {},
      fallback: {},
      multi: {
        scalar: [],
        sequence: [],
        mapping: [],
        fallback: []
      }
    };
    function collectType(type2) {
      if (type2.multi) {
        result.multi[type2.kind].push(type2);
        result.multi["fallback"].push(type2);
      } else {
        result[type2.kind][type2.tag] = result["fallback"][type2.tag] = type2;
      }
    }
    for (let index = 0, length = arguments.length; index < length; index += 1) {
      arguments[index].forEach(collectType);
    }
    return result;
  }
  function Schema2(definition) {
    return this.extend(definition);
  }
  Schema2.prototype.extend = function extend(definition) {
    let implicit = [];
    let explicit = [];
    if (definition instanceof Type2) {
      explicit.push(definition);
    } else if (Array.isArray(definition)) {
      explicit = explicit.concat(definition);
    } else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
      if (definition.implicit) implicit = implicit.concat(definition.implicit);
      if (definition.explicit) explicit = explicit.concat(definition.explicit);
    } else {
      throw new YAMLException2("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
    }
    implicit.forEach(function(type2) {
      if (!(type2 instanceof Type2)) {
        throw new YAMLException2("Specified list of YAML types (or a single Type object) contains a non-Type object.");
      }
      if (type2.loadKind && type2.loadKind !== "scalar") {
        throw new YAMLException2("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
      }
      if (type2.multi) {
        throw new YAMLException2("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
      }
    });
    explicit.forEach(function(type2) {
      if (!(type2 instanceof Type2)) {
        throw new YAMLException2("Specified list of YAML types (or a single Type object) contains a non-Type object.");
      }
    });
    const result = Object.create(Schema2.prototype);
    result.implicit = (this.implicit || []).concat(implicit);
    result.explicit = (this.explicit || []).concat(explicit);
    result.compiledImplicit = compileList(result, "implicit");
    result.compiledExplicit = compileList(result, "explicit");
    result.compiledTypeMap = compileMap(result.compiledImplicit, result.compiledExplicit);
    return result;
  };
  schema = Schema2;
  return schema;
}
var str;
var hasRequiredStr;
function requireStr() {
  if (hasRequiredStr) return str;
  hasRequiredStr = 1;
  const Type2 = requireType();
  str = new Type2("tag:yaml.org,2002:str", {
    kind: "scalar",
    construct: function(data) {
      return data !== null ? data : "";
    }
  });
  return str;
}
var seq;
var hasRequiredSeq;
function requireSeq() {
  if (hasRequiredSeq) return seq;
  hasRequiredSeq = 1;
  const Type2 = requireType();
  seq = new Type2("tag:yaml.org,2002:seq", {
    kind: "sequence",
    construct: function(data) {
      return data !== null ? data : [];
    }
  });
  return seq;
}
var map;
var hasRequiredMap;
function requireMap() {
  if (hasRequiredMap) return map;
  hasRequiredMap = 1;
  const Type2 = requireType();
  map = new Type2("tag:yaml.org,2002:map", {
    kind: "mapping",
    construct: function(data) {
      return data !== null ? data : {};
    }
  });
  return map;
}
var failsafe;
var hasRequiredFailsafe;
function requireFailsafe() {
  if (hasRequiredFailsafe) return failsafe;
  hasRequiredFailsafe = 1;
  const Schema2 = requireSchema();
  failsafe = new Schema2({
    explicit: [
      requireStr(),
      requireSeq(),
      requireMap()
    ]
  });
  return failsafe;
}
var _null;
var hasRequired_null;
function require_null() {
  if (hasRequired_null) return _null;
  hasRequired_null = 1;
  const Type2 = requireType();
  function resolveYamlNull(data) {
    if (data === null) return true;
    const max = data.length;
    return max === 1 && data === "~" || max === 4 && (data === "null" || data === "Null" || data === "NULL");
  }
  function constructYamlNull() {
    return null;
  }
  function isNull(object) {
    return object === null;
  }
  _null = new Type2("tag:yaml.org,2002:null", {
    kind: "scalar",
    resolve: resolveYamlNull,
    construct: constructYamlNull,
    predicate: isNull,
    represent: {
      canonical: function() {
        return "~";
      },
      lowercase: function() {
        return "null";
      },
      uppercase: function() {
        return "NULL";
      },
      camelcase: function() {
        return "Null";
      },
      empty: function() {
        return "";
      }
    },
    defaultStyle: "lowercase"
  });
  return _null;
}
var bool;
var hasRequiredBool;
function requireBool() {
  if (hasRequiredBool) return bool;
  hasRequiredBool = 1;
  const Type2 = requireType();
  function resolveYamlBoolean(data) {
    if (data === null) return false;
    const max = data.length;
    return max === 4 && (data === "true" || data === "True" || data === "TRUE") || max === 5 && (data === "false" || data === "False" || data === "FALSE");
  }
  function constructYamlBoolean(data) {
    return data === "true" || data === "True" || data === "TRUE";
  }
  function isBoolean(object) {
    return Object.prototype.toString.call(object) === "[object Boolean]";
  }
  bool = new Type2("tag:yaml.org,2002:bool", {
    kind: "scalar",
    resolve: resolveYamlBoolean,
    construct: constructYamlBoolean,
    predicate: isBoolean,
    represent: {
      lowercase: function(object) {
        return object ? "true" : "false";
      },
      uppercase: function(object) {
        return object ? "TRUE" : "FALSE";
      },
      camelcase: function(object) {
        return object ? "True" : "False";
      }
    },
    defaultStyle: "lowercase"
  });
  return bool;
}
var int;
var hasRequiredInt;
function requireInt() {
  if (hasRequiredInt) return int;
  hasRequiredInt = 1;
  const common2 = requireCommon();
  const Type2 = requireType();
  function isHexCode(c2) {
    return c2 >= 48 && c2 <= 57 || c2 >= 65 && c2 <= 70 || c2 >= 97 && c2 <= 102;
  }
  function isOctCode(c2) {
    return c2 >= 48 && c2 <= 55;
  }
  function isDecCode(c2) {
    return c2 >= 48 && c2 <= 57;
  }
  function resolveYamlInteger(data) {
    if (data === null) return false;
    const max = data.length;
    let index = 0;
    let hasDigits = false;
    if (!max) return false;
    let ch = data[index];
    if (ch === "-" || ch === "+") {
      ch = data[++index];
    }
    if (ch === "0") {
      if (index + 1 === max) return true;
      ch = data[++index];
      if (ch === "b") {
        index++;
        for (; index < max; index++) {
          ch = data[index];
          if (ch !== "0" && ch !== "1") return false;
          hasDigits = true;
        }
        return hasDigits && isFinite(parseYamlInteger(data));
      }
      if (ch === "x") {
        index++;
        for (; index < max; index++) {
          if (!isHexCode(data.charCodeAt(index))) return false;
          hasDigits = true;
        }
        return hasDigits && isFinite(parseYamlInteger(data));
      }
      if (ch === "o") {
        index++;
        for (; index < max; index++) {
          if (!isOctCode(data.charCodeAt(index))) return false;
          hasDigits = true;
        }
        return hasDigits && isFinite(parseYamlInteger(data));
      }
    }
    for (; index < max; index++) {
      if (!isDecCode(data.charCodeAt(index))) {
        return false;
      }
      hasDigits = true;
    }
    if (!hasDigits) return false;
    return isFinite(parseYamlInteger(data));
  }
  function parseYamlInteger(data) {
    let value = data;
    let sign = 1;
    let ch = value[0];
    if (ch === "-" || ch === "+") {
      if (ch === "-") sign = -1;
      value = value.slice(1);
      ch = value[0];
    }
    if (value === "0") return 0;
    if (ch === "0") {
      if (value[1] === "b") return sign * parseInt(value.slice(2), 2);
      if (value[1] === "x") return sign * parseInt(value.slice(2), 16);
      if (value[1] === "o") return sign * parseInt(value.slice(2), 8);
    }
    return sign * parseInt(value, 10);
  }
  function constructYamlInteger(data) {
    return parseYamlInteger(data);
  }
  function isInteger(object) {
    return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 === 0 && !common2.isNegativeZero(object));
  }
  int = new Type2("tag:yaml.org,2002:int", {
    kind: "scalar",
    resolve: resolveYamlInteger,
    construct: constructYamlInteger,
    predicate: isInteger,
    represent: {
      binary: function(obj) {
        return obj >= 0 ? "0b" + obj.toString(2) : "-0b" + obj.toString(2).slice(1);
      },
      octal: function(obj) {
        return obj >= 0 ? "0o" + obj.toString(8) : "-0o" + obj.toString(8).slice(1);
      },
      decimal: function(obj) {
        return obj.toString(10);
      },
      hexadecimal: function(obj) {
        return obj >= 0 ? "0x" + obj.toString(16).toUpperCase() : "-0x" + obj.toString(16).toUpperCase().slice(1);
      }
    },
    defaultStyle: "decimal",
    styleAliases: {
      binary: [2, "bin"],
      octal: [8, "oct"],
      decimal: [10, "dec"],
      hexadecimal: [16, "hex"]
    }
  });
  return int;
}
var float;
var hasRequiredFloat;
function requireFloat() {
  if (hasRequiredFloat) return float;
  hasRequiredFloat = 1;
  const common2 = requireCommon();
  const Type2 = requireType();
  const YAML_FLOAT_PATTERN = new RegExp(
    // 2.5e4, 2.5 and integers
    "^(?:[-+]?(?:[0-9]+)(?:\\.[0-9]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
  );
  const YAML_FLOAT_SPECIAL_PATTERN = new RegExp(
    "^(?:[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
  );
  function resolveYamlFloat(data) {
    if (data === null) return false;
    if (!YAML_FLOAT_PATTERN.test(data)) {
      return false;
    }
    if (isFinite(parseFloat(data, 10))) {
      return true;
    }
    return YAML_FLOAT_SPECIAL_PATTERN.test(data);
  }
  function constructYamlFloat(data) {
    let value = data.toLowerCase();
    const sign = value[0] === "-" ? -1 : 1;
    if ("+-".indexOf(value[0]) >= 0) {
      value = value.slice(1);
    }
    if (value === ".inf") {
      return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    } else if (value === ".nan") {
      return NaN;
    }
    return sign * parseFloat(value, 10);
  }
  const SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
  function representYamlFloat(object, style) {
    if (isNaN(object)) {
      switch (style) {
        case "lowercase":
          return ".nan";
        case "uppercase":
          return ".NAN";
        case "camelcase":
          return ".NaN";
      }
    } else if (Number.POSITIVE_INFINITY === object) {
      switch (style) {
        case "lowercase":
          return ".inf";
        case "uppercase":
          return ".INF";
        case "camelcase":
          return ".Inf";
      }
    } else if (Number.NEGATIVE_INFINITY === object) {
      switch (style) {
        case "lowercase":
          return "-.inf";
        case "uppercase":
          return "-.INF";
        case "camelcase":
          return "-.Inf";
      }
    } else if (common2.isNegativeZero(object)) {
      return "-0.0";
    }
    const res = object.toString(10);
    return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace("e", ".e") : res;
  }
  function isFloat(object) {
    return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 !== 0 || common2.isNegativeZero(object));
  }
  float = new Type2("tag:yaml.org,2002:float", {
    kind: "scalar",
    resolve: resolveYamlFloat,
    construct: constructYamlFloat,
    predicate: isFloat,
    represent: representYamlFloat,
    defaultStyle: "lowercase"
  });
  return float;
}
var json;
var hasRequiredJson;
function requireJson() {
  if (hasRequiredJson) return json;
  hasRequiredJson = 1;
  json = requireFailsafe().extend({
    implicit: [
      require_null(),
      requireBool(),
      requireInt(),
      requireFloat()
    ]
  });
  return json;
}
var core;
var hasRequiredCore;
function requireCore() {
  if (hasRequiredCore) return core;
  hasRequiredCore = 1;
  core = requireJson();
  return core;
}
var timestamp;
var hasRequiredTimestamp;
function requireTimestamp() {
  if (hasRequiredTimestamp) return timestamp;
  hasRequiredTimestamp = 1;
  const Type2 = requireType();
  const YAML_DATE_REGEXP = new RegExp(
    "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
  );
  const YAML_TIMESTAMP_REGEXP = new RegExp(
    "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
  );
  function resolveYamlTimestamp(data) {
    if (data === null) return false;
    if (YAML_DATE_REGEXP.exec(data) !== null) return true;
    if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true;
    return false;
  }
  function constructYamlTimestamp(data) {
    let fraction = 0;
    let delta = null;
    let match = YAML_DATE_REGEXP.exec(data);
    if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);
    if (match === null) throw new Error("Date resolve error");
    const year = +match[1];
    const month = +match[2] - 1;
    const day = +match[3];
    if (!match[4]) {
      return new Date(Date.UTC(year, month, day));
    }
    const hour = +match[4];
    const minute = +match[5];
    const second = +match[6];
    if (match[7]) {
      fraction = match[7].slice(0, 3);
      while (fraction.length < 3) {
        fraction += "0";
      }
      fraction = +fraction;
    }
    if (match[9]) {
      const tzHour = +match[10];
      const tzMinute = +(match[11] || 0);
      delta = (tzHour * 60 + tzMinute) * 6e4;
      if (match[9] === "-") delta = -delta;
    }
    const date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
    if (delta) date.setTime(date.getTime() - delta);
    return date;
  }
  function representYamlTimestamp(object) {
    return object.toISOString();
  }
  timestamp = new Type2("tag:yaml.org,2002:timestamp", {
    kind: "scalar",
    resolve: resolveYamlTimestamp,
    construct: constructYamlTimestamp,
    instanceOf: Date,
    represent: representYamlTimestamp
  });
  return timestamp;
}
var merge;
var hasRequiredMerge;
function requireMerge() {
  if (hasRequiredMerge) return merge;
  hasRequiredMerge = 1;
  const Type2 = requireType();
  function resolveYamlMerge(data) {
    return data === "<<" || data === null;
  }
  merge = new Type2("tag:yaml.org,2002:merge", {
    kind: "scalar",
    resolve: resolveYamlMerge
  });
  return merge;
}
var binary;
var hasRequiredBinary;
function requireBinary() {
  if (hasRequiredBinary) return binary;
  hasRequiredBinary = 1;
  const Type2 = requireType();
  const BASE64_MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r";
  function resolveYamlBinary(data) {
    if (data === null) return false;
    let bitlen = 0;
    const max = data.length;
    const map2 = BASE64_MAP;
    for (let idx = 0; idx < max; idx++) {
      const code = map2.indexOf(data.charAt(idx));
      if (code > 64) continue;
      if (code < 0) return false;
      bitlen += 6;
    }
    return bitlen % 8 === 0;
  }
  function constructYamlBinary(data) {
    const input = data.replace(/[\r\n=]/g, "");
    const max = input.length;
    const map2 = BASE64_MAP;
    let bits = 0;
    const result = [];
    for (let idx = 0; idx < max; idx++) {
      if (idx % 4 === 0 && idx) {
        result.push(bits >> 16 & 255);
        result.push(bits >> 8 & 255);
        result.push(bits & 255);
      }
      bits = bits << 6 | map2.indexOf(input.charAt(idx));
    }
    const tailbits = max % 4 * 6;
    if (tailbits === 0) {
      result.push(bits >> 16 & 255);
      result.push(bits >> 8 & 255);
      result.push(bits & 255);
    } else if (tailbits === 18) {
      result.push(bits >> 10 & 255);
      result.push(bits >> 2 & 255);
    } else if (tailbits === 12) {
      result.push(bits >> 4 & 255);
    }
    return new Uint8Array(result);
  }
  function representYamlBinary(object) {
    let result = "";
    let bits = 0;
    const max = object.length;
    const map2 = BASE64_MAP;
    for (let idx = 0; idx < max; idx++) {
      if (idx % 3 === 0 && idx) {
        result += map2[bits >> 18 & 63];
        result += map2[bits >> 12 & 63];
        result += map2[bits >> 6 & 63];
        result += map2[bits & 63];
      }
      bits = (bits << 8) + object[idx];
    }
    const tail = max % 3;
    if (tail === 0) {
      result += map2[bits >> 18 & 63];
      result += map2[bits >> 12 & 63];
      result += map2[bits >> 6 & 63];
      result += map2[bits & 63];
    } else if (tail === 2) {
      result += map2[bits >> 10 & 63];
      result += map2[bits >> 4 & 63];
      result += map2[bits << 2 & 63];
      result += map2[64];
    } else if (tail === 1) {
      result += map2[bits >> 2 & 63];
      result += map2[bits << 4 & 63];
      result += map2[64];
      result += map2[64];
    }
    return result;
  }
  function isBinary(obj) {
    return Object.prototype.toString.call(obj) === "[object Uint8Array]";
  }
  binary = new Type2("tag:yaml.org,2002:binary", {
    kind: "scalar",
    resolve: resolveYamlBinary,
    construct: constructYamlBinary,
    predicate: isBinary,
    represent: representYamlBinary
  });
  return binary;
}
var omap;
var hasRequiredOmap;
function requireOmap() {
  if (hasRequiredOmap) return omap;
  hasRequiredOmap = 1;
  const Type2 = requireType();
  const _hasOwnProperty = Object.prototype.hasOwnProperty;
  const _toString = Object.prototype.toString;
  function resolveYamlOmap(data) {
    if (data === null) return true;
    const objectKeys = {};
    const object = data;
    for (let index = 0, length = object.length; index < length; index += 1) {
      const pair = object[index];
      let pairHasKey = false;
      if (_toString.call(pair) !== "[object Object]") return false;
      let pairKey;
      for (pairKey in pair) {
        if (_hasOwnProperty.call(pair, pairKey)) {
          if (!pairHasKey) pairHasKey = true;
          else return false;
        }
      }
      if (!pairHasKey) return false;
      if (_hasOwnProperty.call(objectKeys, pairKey)) return false;
      Object.defineProperty(objectKeys, pairKey, { value: true });
    }
    return true;
  }
  function constructYamlOmap(data) {
    return data !== null ? data : [];
  }
  omap = new Type2("tag:yaml.org,2002:omap", {
    kind: "sequence",
    resolve: resolveYamlOmap,
    construct: constructYamlOmap
  });
  return omap;
}
var pairs;
var hasRequiredPairs;
function requirePairs() {
  if (hasRequiredPairs) return pairs;
  hasRequiredPairs = 1;
  const Type2 = requireType();
  const _toString = Object.prototype.toString;
  function resolveYamlPairs(data) {
    if (data === null) return true;
    const object = data;
    const result = new Array(object.length);
    for (let index = 0, length = object.length; index < length; index += 1) {
      const pair = object[index];
      if (_toString.call(pair) !== "[object Object]") return false;
      const keys = Object.keys(pair);
      if (keys.length !== 1) return false;
      result[index] = [keys[0], pair[keys[0]]];
    }
    return true;
  }
  function constructYamlPairs(data) {
    if (data === null) return [];
    const object = data;
    const result = new Array(object.length);
    for (let index = 0, length = object.length; index < length; index += 1) {
      const pair = object[index];
      const keys = Object.keys(pair);
      result[index] = [keys[0], pair[keys[0]]];
    }
    return result;
  }
  pairs = new Type2("tag:yaml.org,2002:pairs", {
    kind: "sequence",
    resolve: resolveYamlPairs,
    construct: constructYamlPairs
  });
  return pairs;
}
var set;
var hasRequiredSet;
function requireSet() {
  if (hasRequiredSet) return set;
  hasRequiredSet = 1;
  const Type2 = requireType();
  const _hasOwnProperty = Object.prototype.hasOwnProperty;
  function resolveYamlSet(data) {
    if (data === null) return true;
    const object = data;
    for (const key in object) {
      if (_hasOwnProperty.call(object, key)) {
        if (object[key] !== null) return false;
      }
    }
    return true;
  }
  function constructYamlSet(data) {
    return data !== null ? data : {};
  }
  set = new Type2("tag:yaml.org,2002:set", {
    kind: "mapping",
    resolve: resolveYamlSet,
    construct: constructYamlSet
  });
  return set;
}
var _default;
var hasRequired_default;
function require_default() {
  if (hasRequired_default) return _default;
  hasRequired_default = 1;
  _default = requireCore().extend({
    implicit: [
      requireTimestamp(),
      requireMerge()
    ],
    explicit: [
      requireBinary(),
      requireOmap(),
      requirePairs(),
      requireSet()
    ]
  });
  return _default;
}
var hasRequiredLoader;
function requireLoader() {
  if (hasRequiredLoader) return loader;
  hasRequiredLoader = 1;
  const common2 = requireCommon();
  const YAMLException2 = requireException();
  const makeSnippet = requireSnippet();
  const DEFAULT_SCHEMA2 = require_default();
  const _hasOwnProperty = Object.prototype.hasOwnProperty;
  const CONTEXT_FLOW_IN = 1;
  const CONTEXT_FLOW_OUT = 2;
  const CONTEXT_BLOCK_IN = 3;
  const CONTEXT_BLOCK_OUT = 4;
  const CHOMPING_CLIP = 1;
  const CHOMPING_STRIP = 2;
  const CHOMPING_KEEP = 3;
  const PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
  const PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
  const PATTERN_FLOW_INDICATORS = /[,\[\]{}]/;
  const PATTERN_TAG_HANDLE = /^(?:!|!!|![0-9A-Za-z-]+!)$/;
  const PATTERN_TAG_URI = /^(?:!|[^,\[\]{}])(?:%[0-9a-f]{2}|[0-9a-z\-#;/?:@&=+$,_.!~*'()\[\]])*$/i;
  function _class(obj) {
    return Object.prototype.toString.call(obj);
  }
  function isEol(c2) {
    return c2 === 10 || c2 === 13;
  }
  function isWhiteSpace(c2) {
    return c2 === 9 || c2 === 32;
  }
  function isWsOrEol(c2) {
    return c2 === 9 || c2 === 32 || c2 === 10 || c2 === 13;
  }
  function isFlowIndicator(c2) {
    return c2 === 44 || c2 === 91 || c2 === 93 || c2 === 123 || c2 === 125;
  }
  function fromHexCode(c2) {
    if (c2 >= 48 && c2 <= 57) {
      return c2 - 48;
    }
    const lc = c2 | 32;
    if (lc >= 97 && lc <= 102) {
      return lc - 97 + 10;
    }
    return -1;
  }
  function escapedHexLen(c2) {
    if (c2 === 120) {
      return 2;
    }
    if (c2 === 117) {
      return 4;
    }
    if (c2 === 85) {
      return 8;
    }
    return 0;
  }
  function fromDecimalCode(c2) {
    if (c2 >= 48 && c2 <= 57) {
      return c2 - 48;
    }
    return -1;
  }
  function simpleEscapeSequence(c2) {
    switch (c2) {
      case 48:
        return "\0";
      case 97:
        return "\x07";
      case 98:
        return "\b";
      case 116:
        return "	";
      case 9:
        return "	";
      case 110:
        return "\n";
      case 118:
        return "\v";
      case 102:
        return "\f";
      case 114:
        return "\r";
      case 101:
        return "\x1B";
      case 32:
        return " ";
      case 34:
        return '"';
      case 47:
        return "/";
      case 92:
        return "\\";
      case 78:
        return "\x85";
      case 95:
        return "\xA0";
      case 76:
        return "\u2028";
      case 80:
        return "\u2029";
      default:
        return "";
    }
  }
  function charFromCodepoint(c2) {
    if (c2 <= 65535) {
      return String.fromCharCode(c2);
    }
    return String.fromCharCode(
      (c2 - 65536 >> 10) + 55296,
      (c2 - 65536 & 1023) + 56320
    );
  }
  function setProperty(object, key, value) {
    if (key === "__proto__") {
      Object.defineProperty(object, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value
      });
    } else {
      object[key] = value;
    }
  }
  const simpleEscapeCheck = new Array(256);
  const simpleEscapeMap = new Array(256);
  for (let i = 0; i < 256; i++) {
    simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
    simpleEscapeMap[i] = simpleEscapeSequence(i);
  }
  function State(input, options) {
    this.input = input;
    this.filename = options["filename"] || null;
    this.schema = options["schema"] || DEFAULT_SCHEMA2;
    this.onWarning = options["onWarning"] || null;
    this.legacy = options["legacy"] || false;
    this.json = options["json"] || false;
    this.listener = options["listener"] || null;
    this.maxDepth = typeof options["maxDepth"] === "number" ? options["maxDepth"] : 100;
    this.maxTotalMergeKeys = typeof options["maxTotalMergeKeys"] === "number" ? options["maxTotalMergeKeys"] : 1e4;
    this.implicitTypes = this.schema.compiledImplicit;
    this.typeMap = this.schema.compiledTypeMap;
    this.length = input.length;
    this.position = 0;
    this.line = 0;
    this.lineStart = 0;
    this.lineIndent = 0;
    this.depth = 0;
    this.totalMergeKeys = 0;
    this.firstTabInLine = -1;
    this.documents = [];
    this.anchorMapTransactions = [];
  }
  function generateError(state, message) {
    const mark = {
      name: state.filename,
      buffer: state.input.slice(0, -1),
      // omit trailing \0
      position: state.position,
      line: state.line,
      column: state.position - state.lineStart
    };
    mark.snippet = makeSnippet(mark);
    return new YAMLException2(message, mark);
  }
  function throwError(state, message) {
    throw generateError(state, message);
  }
  function throwWarning(state, message) {
    if (state.onWarning) {
      state.onWarning.call(null, generateError(state, message));
    }
  }
  function storeAnchor(state, name, value) {
    const transactions = state.anchorMapTransactions;
    if (transactions.length !== 0) {
      const transaction = transactions[transactions.length - 1];
      if (!_hasOwnProperty.call(transaction, name)) {
        transaction[name] = {
          existed: _hasOwnProperty.call(state.anchorMap, name),
          value: state.anchorMap[name]
        };
      }
    }
    state.anchorMap[name] = value;
  }
  function beginAnchorTransaction(state) {
    state.anchorMapTransactions.push(/* @__PURE__ */ Object.create(null));
  }
  function commitAnchorTransaction(state) {
    const transaction = state.anchorMapTransactions.pop();
    const transactions = state.anchorMapTransactions;
    if (transactions.length === 0) return;
    const parent = transactions[transactions.length - 1];
    const names = Object.keys(transaction);
    for (let index = 0, length = names.length; index < length; index += 1) {
      const name = names[index];
      if (!_hasOwnProperty.call(parent, name)) {
        parent[name] = transaction[name];
      }
    }
  }
  function rollbackAnchorTransaction(state) {
    const transaction = state.anchorMapTransactions.pop();
    const names = Object.keys(transaction);
    for (let index = names.length - 1; index >= 0; index -= 1) {
      const entry = transaction[names[index]];
      if (entry.existed) {
        state.anchorMap[names[index]] = entry.value;
      } else {
        delete state.anchorMap[names[index]];
      }
    }
  }
  function snapshotState(state) {
    return {
      position: state.position,
      line: state.line,
      lineStart: state.lineStart,
      lineIndent: state.lineIndent,
      firstTabInLine: state.firstTabInLine,
      tag: state.tag,
      anchor: state.anchor,
      kind: state.kind,
      result: state.result
    };
  }
  function restoreState(state, snapshot) {
    state.position = snapshot.position;
    state.line = snapshot.line;
    state.lineStart = snapshot.lineStart;
    state.lineIndent = snapshot.lineIndent;
    state.firstTabInLine = snapshot.firstTabInLine;
    state.tag = snapshot.tag;
    state.anchor = snapshot.anchor;
    state.kind = snapshot.kind;
    state.result = snapshot.result;
  }
  const directiveHandlers = {
    YAML: function handleYamlDirective(state, name, args) {
      if (state.version !== null) {
        throwError(state, "duplication of %YAML directive");
      }
      if (args.length !== 1) {
        throwError(state, "YAML directive accepts exactly one argument");
      }
      const match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
      if (match === null) {
        throwError(state, "ill-formed argument of the YAML directive");
      }
      const major = parseInt(match[1], 10);
      const minor = parseInt(match[2], 10);
      if (major !== 1) {
        throwError(state, "unacceptable YAML version of the document");
      }
      state.version = args[0];
      state.checkLineBreaks = minor < 2;
      if (minor !== 1 && minor !== 2) {
        throwWarning(state, "unsupported YAML version of the document");
      }
    },
    TAG: function handleTagDirective(state, name, args) {
      let prefix;
      if (args.length !== 2) {
        throwError(state, "TAG directive accepts exactly two arguments");
      }
      const handle = args[0];
      prefix = args[1];
      if (!PATTERN_TAG_HANDLE.test(handle)) {
        throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
      }
      if (_hasOwnProperty.call(state.tagMap, handle)) {
        throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
      }
      if (!PATTERN_TAG_URI.test(prefix)) {
        throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
      }
      try {
        prefix = decodeURIComponent(prefix);
      } catch (err) {
        throwError(state, "tag prefix is malformed: " + prefix);
      }
      state.tagMap[handle] = prefix;
    }
  };
  function captureSegment(state, start, end, checkJson) {
    if (start < end) {
      const _result = state.input.slice(start, end);
      if (checkJson) {
        for (let _position = 0, _length = _result.length; _position < _length; _position += 1) {
          const _character = _result.charCodeAt(_position);
          if (!(_character === 9 || _character >= 32 && _character <= 1114111)) {
            throwError(state, "expected valid JSON character");
          }
        }
      } else if (PATTERN_NON_PRINTABLE.test(_result)) {
        throwError(state, "the stream contains non-printable characters");
      }
      state.result += _result;
    }
  }
  function chargeMergeWork(state) {
    state.totalMergeKeys++;
    if (state.maxTotalMergeKeys !== -1 && state.totalMergeKeys > state.maxTotalMergeKeys) {
      throwError(state, "merge keys exceeded maxTotalMergeKeys (" + state.maxTotalMergeKeys + ")");
    }
  }
  function mergeMappings(state, destination, source, overridableKeys) {
    if (!common2.isObject(source)) {
      throwError(state, "cannot merge mappings; the provided source object is unacceptable");
    }
    chargeMergeWork(state);
    const sourceKeys = Object.keys(source);
    for (let index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
      const key = sourceKeys[index];
      chargeMergeWork(state);
      if (!_hasOwnProperty.call(destination, key)) {
        setProperty(destination, key, source[key]);
        overridableKeys[key] = true;
      }
    }
  }
  function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startLineStart, startPos) {
    if (Array.isArray(keyNode)) {
      keyNode = Array.prototype.slice.call(keyNode);
      for (let index = 0, quantity = keyNode.length; index < quantity; index += 1) {
        if (Array.isArray(keyNode[index])) {
          throwError(state, "nested arrays are not supported inside keys");
        }
        if (typeof keyNode === "object" && _class(keyNode[index]) === "[object Object]") {
          keyNode[index] = "[object Object]";
        }
      }
    }
    if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") {
      keyNode = "[object Object]";
    }
    keyNode = String(keyNode);
    if (_result === null) {
      _result = {};
    }
    if (keyTag === "tag:yaml.org,2002:merge") {
      if (Array.isArray(valueNode)) {
        if (valueNode.length > 100) {
          throwError(state, "abnormal merge sequence size");
        }
        for (let index = 0, quantity = valueNode.length; index < quantity; index += 1) {
          mergeMappings(state, _result, valueNode[index], overridableKeys);
        }
      } else {
        mergeMappings(state, _result, valueNode, overridableKeys);
      }
    } else {
      if (!state.json && !_hasOwnProperty.call(overridableKeys, keyNode) && _hasOwnProperty.call(_result, keyNode)) {
        state.line = startLine || state.line;
        state.lineStart = startLineStart || state.lineStart;
        state.position = startPos || state.position;
        throwError(state, "duplicated mapping key");
      }
      setProperty(_result, keyNode, valueNode);
      delete overridableKeys[keyNode];
    }
    return _result;
  }
  function readLineBreak(state) {
    const ch = state.input.charCodeAt(state.position);
    if (ch === 10) {
      state.position++;
    } else if (ch === 13) {
      state.position++;
      if (state.input.charCodeAt(state.position) === 10) {
        state.position++;
      }
    } else {
      throwError(state, "a line break is expected");
    }
    state.line += 1;
    state.lineStart = state.position;
    state.firstTabInLine = -1;
  }
  function skipSeparationSpace(state, allowComments, checkIndent) {
    let lineBreaks = 0;
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      while (isWhiteSpace(ch)) {
        if (ch === 9 && state.firstTabInLine === -1) {
          state.firstTabInLine = state.position;
        }
        ch = state.input.charCodeAt(++state.position);
      }
      if (allowComments && ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (ch !== 10 && ch !== 13 && ch !== 0);
      }
      if (isEol(ch)) {
        readLineBreak(state);
        ch = state.input.charCodeAt(state.position);
        lineBreaks++;
        state.lineIndent = 0;
        while (ch === 32) {
          state.lineIndent++;
          ch = state.input.charCodeAt(++state.position);
        }
      } else {
        break;
      }
    }
    if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
      throwWarning(state, "deficient indentation");
    }
    return lineBreaks;
  }
  function testDocumentSeparator(state) {
    let _position = state.position;
    let ch = state.input.charCodeAt(_position);
    if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(_position + 1) && ch === state.input.charCodeAt(_position + 2)) {
      _position += 3;
      ch = state.input.charCodeAt(_position);
      if (ch === 0 || isWsOrEol(ch)) {
        return true;
      }
    }
    return false;
  }
  function writeFoldedLines(state, count) {
    if (count === 1) {
      state.result += " ";
    } else if (count > 1) {
      state.result += common2.repeat("\n", count - 1);
    }
  }
  function readPlainScalar(state, nodeIndent, withinFlowCollection) {
    let captureStart;
    let captureEnd;
    let hasPendingContent;
    let _line;
    let _lineStart;
    let _lineIndent;
    const _kind = state.kind;
    const _result = state.result;
    let ch = state.input.charCodeAt(state.position);
    if (isWsOrEol(ch) || isFlowIndicator(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96) {
      return false;
    }
    if (ch === 63 || ch === 45) {
      const following = state.input.charCodeAt(state.position + 1);
      if (isWsOrEol(following) || withinFlowCollection && isFlowIndicator(following)) {
        return false;
      }
    }
    state.kind = "scalar";
    state.result = "";
    captureStart = captureEnd = state.position;
    hasPendingContent = false;
    while (ch !== 0) {
      if (ch === 58) {
        const following = state.input.charCodeAt(state.position + 1);
        if (isWsOrEol(following) || withinFlowCollection && isFlowIndicator(following)) {
          break;
        }
      } else if (ch === 35) {
        const preceding = state.input.charCodeAt(state.position - 1);
        if (isWsOrEol(preceding)) {
          break;
        }
      } else if (state.position === state.lineStart && testDocumentSeparator(state) || withinFlowCollection && isFlowIndicator(ch)) {
        break;
      } else if (isEol(ch)) {
        _line = state.line;
        _lineStart = state.lineStart;
        _lineIndent = state.lineIndent;
        skipSeparationSpace(state, false, -1);
        if (state.lineIndent >= nodeIndent) {
          hasPendingContent = true;
          ch = state.input.charCodeAt(state.position);
          continue;
        } else {
          state.position = captureEnd;
          state.line = _line;
          state.lineStart = _lineStart;
          state.lineIndent = _lineIndent;
          break;
        }
      }
      if (hasPendingContent) {
        captureSegment(state, captureStart, captureEnd, false);
        writeFoldedLines(state, state.line - _line);
        captureStart = captureEnd = state.position;
        hasPendingContent = false;
      }
      if (!isWhiteSpace(ch)) {
        captureEnd = state.position + 1;
      }
      ch = state.input.charCodeAt(++state.position);
    }
    captureSegment(state, captureStart, captureEnd, false);
    if (state.result) {
      return true;
    }
    state.kind = _kind;
    state.result = _result;
    return false;
  }
  function readSingleQuotedScalar(state, nodeIndent) {
    let captureStart;
    let captureEnd;
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 39) {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      if (ch === 39) {
        captureSegment(state, captureStart, state.position, true);
        ch = state.input.charCodeAt(++state.position);
        if (ch === 39) {
          captureStart = state.position;
          state.position++;
          captureEnd = state.position;
        } else {
          return true;
        }
      } else if (isEol(ch)) {
        captureSegment(state, captureStart, captureEnd, true);
        writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
        captureStart = captureEnd = state.position;
      } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
        throwError(state, "unexpected end of the document within a single quoted scalar");
      } else {
        state.position++;
        if (!isWhiteSpace(ch)) {
          captureEnd = state.position;
        }
      }
    }
    throwError(state, "unexpected end of the stream within a single quoted scalar");
  }
  function readDoubleQuotedScalar(state, nodeIndent) {
    let captureStart;
    let captureEnd;
    let tmp;
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 34) {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      if (ch === 34) {
        captureSegment(state, captureStart, state.position, true);
        state.position++;
        return true;
      } else if (ch === 92) {
        captureSegment(state, captureStart, state.position, true);
        ch = state.input.charCodeAt(++state.position);
        if (isEol(ch)) {
          skipSeparationSpace(state, false, nodeIndent);
        } else if (ch < 256 && simpleEscapeCheck[ch]) {
          state.result += simpleEscapeMap[ch];
          state.position++;
        } else if ((tmp = escapedHexLen(ch)) > 0) {
          let hexLength = tmp;
          let hexResult = 0;
          for (; hexLength > 0; hexLength--) {
            ch = state.input.charCodeAt(++state.position);
            if ((tmp = fromHexCode(ch)) >= 0) {
              hexResult = (hexResult << 4) + tmp;
            } else {
              throwError(state, "expected hexadecimal character");
            }
          }
          state.result += charFromCodepoint(hexResult);
          state.position++;
        } else {
          throwError(state, "unknown escape sequence");
        }
        captureStart = captureEnd = state.position;
      } else if (isEol(ch)) {
        captureSegment(state, captureStart, captureEnd, true);
        writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
        captureStart = captureEnd = state.position;
      } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
        throwError(state, "unexpected end of the document within a double quoted scalar");
      } else {
        state.position++;
        if (!isWhiteSpace(ch)) {
          captureEnd = state.position;
        }
      }
    }
    throwError(state, "unexpected end of the stream within a double quoted scalar");
  }
  function readFlowCollection(state, nodeIndent) {
    let readNext = true;
    let _line;
    let _lineStart;
    let _pos;
    const _tag = state.tag;
    let _result;
    const _anchor = state.anchor;
    let terminator;
    let isPair;
    let isExplicitPair;
    let isMapping;
    const overridableKeys = /* @__PURE__ */ Object.create(null);
    let keyNode;
    let keyTag;
    let valueNode;
    let ch = state.input.charCodeAt(state.position);
    if (ch === 91) {
      terminator = 93;
      isMapping = false;
      _result = [];
    } else if (ch === 123) {
      terminator = 125;
      isMapping = true;
      _result = {};
    } else {
      return false;
    }
    if (state.anchor !== null) {
      storeAnchor(state, state.anchor, _result);
    }
    ch = state.input.charCodeAt(++state.position);
    while (ch !== 0) {
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if (ch === terminator) {
        state.position++;
        state.tag = _tag;
        state.anchor = _anchor;
        state.kind = isMapping ? "mapping" : "sequence";
        state.result = _result;
        return true;
      } else if (!readNext) {
        throwError(state, "missed comma between flow collection entries");
      } else if (ch === 44) {
        throwError(state, "expected the node content, but found ','");
      }
      keyTag = keyNode = valueNode = null;
      isPair = isExplicitPair = false;
      if (ch === 63) {
        const following = state.input.charCodeAt(state.position + 1);
        if (isWsOrEol(following)) {
          isPair = isExplicitPair = true;
          state.position++;
          skipSeparationSpace(state, true, nodeIndent);
        }
      }
      _line = state.line;
      _lineStart = state.lineStart;
      _pos = state.position;
      composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      keyTag = state.tag;
      keyNode = state.result;
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if ((isExplicitPair || state.line === _line) && ch === 58) {
        isPair = true;
        ch = state.input.charCodeAt(++state.position);
        skipSeparationSpace(state, true, nodeIndent);
        composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
        valueNode = state.result;
      }
      if (isMapping) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
      } else if (isPair) {
        _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
      } else {
        _result.push(keyNode);
      }
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if (ch === 44) {
        readNext = true;
        ch = state.input.charCodeAt(++state.position);
      } else {
        readNext = false;
      }
    }
    throwError(state, "unexpected end of the stream within a flow collection");
  }
  function readBlockScalar(state, nodeIndent) {
    let folding;
    let chomping = CHOMPING_CLIP;
    let didReadContent = false;
    let detectedIndent = false;
    let textIndent = nodeIndent;
    let emptyLines = 0;
    let atMoreIndented = false;
    let tmp;
    let ch = state.input.charCodeAt(state.position);
    if (ch === 124) {
      folding = false;
    } else if (ch === 62) {
      folding = true;
    } else {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    while (ch !== 0) {
      ch = state.input.charCodeAt(++state.position);
      if (ch === 43 || ch === 45) {
        if (CHOMPING_CLIP === chomping) {
          chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
        } else {
          throwError(state, "repeat of a chomping mode identifier");
        }
      } else if ((tmp = fromDecimalCode(ch)) >= 0) {
        if (tmp === 0) {
          throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
        } else if (!detectedIndent) {
          textIndent = nodeIndent + tmp - 1;
          detectedIndent = true;
        } else {
          throwError(state, "repeat of an indentation width identifier");
        }
      } else {
        break;
      }
    }
    if (isWhiteSpace(ch)) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (isWhiteSpace(ch));
      if (ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (!isEol(ch) && ch !== 0);
      }
    }
    while (ch !== 0) {
      readLineBreak(state);
      state.lineIndent = 0;
      ch = state.input.charCodeAt(state.position);
      while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
      if (!detectedIndent && state.lineIndent > textIndent) {
        textIndent = state.lineIndent;
      }
      if (isEol(ch)) {
        emptyLines++;
        continue;
      }
      if (!detectedIndent && textIndent === 0) {
        throwError(state, "missing indentation for block scalar");
      }
      if (state.lineIndent < textIndent) {
        if (chomping === CHOMPING_KEEP) {
          state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
        } else if (chomping === CHOMPING_CLIP) {
          if (didReadContent) {
            state.result += "\n";
          }
        }
        break;
      }
      if (folding) {
        if (isWhiteSpace(ch)) {
          atMoreIndented = true;
          state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
        } else if (atMoreIndented) {
          atMoreIndented = false;
          state.result += common2.repeat("\n", emptyLines + 1);
        } else if (emptyLines === 0) {
          if (didReadContent) {
            state.result += " ";
          }
        } else {
          state.result += common2.repeat("\n", emptyLines);
        }
      } else {
        state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
      }
      didReadContent = true;
      detectedIndent = true;
      emptyLines = 0;
      const captureStart = state.position;
      while (!isEol(ch) && ch !== 0) {
        ch = state.input.charCodeAt(++state.position);
      }
      captureSegment(state, captureStart, state.position, false);
    }
    return true;
  }
  function readBlockSequence(state, nodeIndent) {
    const _tag = state.tag;
    const _anchor = state.anchor;
    const _result = [];
    let detected = false;
    if (state.firstTabInLine !== -1) return false;
    if (state.anchor !== null) {
      storeAnchor(state, state.anchor, _result);
    }
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      if (state.firstTabInLine !== -1) {
        state.position = state.firstTabInLine;
        throwError(state, "tab characters must not be used in indentation");
      }
      if (ch !== 45) {
        break;
      }
      const following = state.input.charCodeAt(state.position + 1);
      if (!isWsOrEol(following)) {
        break;
      }
      detected = true;
      state.position++;
      if (skipSeparationSpace(state, true, -1)) {
        if (state.lineIndent <= nodeIndent) {
          _result.push(null);
          ch = state.input.charCodeAt(state.position);
          continue;
        }
      }
      const _line = state.line;
      composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
      _result.push(state.result);
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
      if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
        throwError(state, "bad indentation of a sequence entry");
      } else if (state.lineIndent < nodeIndent) {
        break;
      }
    }
    if (detected) {
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = "sequence";
      state.result = _result;
      return true;
    }
    return false;
  }
  function readBlockMapping(state, nodeIndent, flowIndent) {
    let allowCompact;
    let _keyLine;
    let _keyLineStart;
    let _keyPos;
    const _tag = state.tag;
    const _anchor = state.anchor;
    const _result = {};
    const overridableKeys = /* @__PURE__ */ Object.create(null);
    let keyTag = null;
    let keyNode = null;
    let valueNode = null;
    let atExplicitKey = false;
    let detected = false;
    if (state.firstTabInLine !== -1) return false;
    if (state.anchor !== null) {
      storeAnchor(state, state.anchor, _result);
    }
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      if (!atExplicitKey && state.firstTabInLine !== -1) {
        state.position = state.firstTabInLine;
        throwError(state, "tab characters must not be used in indentation");
      }
      const following = state.input.charCodeAt(state.position + 1);
      const _line = state.line;
      if ((ch === 63 || ch === 58) && isWsOrEol(following)) {
        if (ch === 63) {
          if (atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
            keyTag = keyNode = valueNode = null;
          }
          detected = true;
          atExplicitKey = true;
          allowCompact = true;
        } else if (atExplicitKey) {
          atExplicitKey = false;
          allowCompact = true;
        } else {
          throwError(state, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line");
        }
        state.position += 1;
        ch = following;
      } else {
        _keyLine = state.line;
        _keyLineStart = state.lineStart;
        _keyPos = state.position;
        if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
          break;
        }
        if (state.line === _line) {
          ch = state.input.charCodeAt(state.position);
          while (isWhiteSpace(ch)) {
            ch = state.input.charCodeAt(++state.position);
          }
          if (ch === 58) {
            ch = state.input.charCodeAt(++state.position);
            if (!isWsOrEol(ch)) {
              throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
            }
            if (atExplicitKey) {
              storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
              keyTag = keyNode = valueNode = null;
            }
            detected = true;
            atExplicitKey = false;
            allowCompact = false;
            keyTag = state.tag;
            keyNode = state.result;
          } else if (detected) {
            throwError(state, "can not read an implicit mapping pair; a colon is missed");
          } else {
            state.tag = _tag;
            state.anchor = _anchor;
            return true;
          }
        } else if (detected) {
          throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
        } else {
          state.tag = _tag;
          state.anchor = _anchor;
          return true;
        }
      }
      if (state.line === _line || state.lineIndent > nodeIndent) {
        if (atExplicitKey) {
          _keyLine = state.line;
          _keyLineStart = state.lineStart;
          _keyPos = state.position;
        }
        if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
          if (atExplicitKey) {
            keyNode = state.result;
          } else {
            valueNode = state.result;
          }
        }
        if (!atExplicitKey) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
          keyTag = keyNode = valueNode = null;
        }
        skipSeparationSpace(state, true, -1);
        ch = state.input.charCodeAt(state.position);
      }
      if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
        throwError(state, "bad indentation of a mapping entry");
      } else if (state.lineIndent < nodeIndent) {
        break;
      }
    }
    if (atExplicitKey) {
      storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
    }
    if (detected) {
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = "mapping";
      state.result = _result;
    }
    return detected;
  }
  function readTagProperty(state) {
    let isVerbatim = false;
    let isNamed = false;
    let tagHandle;
    let tagName;
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 33) return false;
    if (state.tag !== null) {
      throwError(state, "duplication of a tag property");
    }
    ch = state.input.charCodeAt(++state.position);
    if (ch === 60) {
      isVerbatim = true;
      ch = state.input.charCodeAt(++state.position);
    } else if (ch === 33) {
      isNamed = true;
      tagHandle = "!!";
      ch = state.input.charCodeAt(++state.position);
    } else {
      tagHandle = "!";
    }
    let _position = state.position;
    if (isVerbatim) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (ch !== 0 && ch !== 62);
      if (state.position < state.length) {
        tagName = state.input.slice(_position, state.position);
        ch = state.input.charCodeAt(++state.position);
      } else {
        throwError(state, "unexpected end of the stream within a verbatim tag");
      }
    } else {
      while (ch !== 0 && !isWsOrEol(ch)) {
        if (ch === 33) {
          if (!isNamed) {
            tagHandle = state.input.slice(_position - 1, state.position + 1);
            if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
              throwError(state, "named tag handle cannot contain such characters");
            }
            isNamed = true;
            _position = state.position + 1;
          } else {
            throwError(state, "tag suffix cannot contain exclamation marks");
          }
        }
        ch = state.input.charCodeAt(++state.position);
      }
      tagName = state.input.slice(_position, state.position);
      if (PATTERN_FLOW_INDICATORS.test(tagName)) {
        throwError(state, "tag suffix cannot contain flow indicator characters");
      }
    }
    if (tagName && !PATTERN_TAG_URI.test(tagName)) {
      throwError(state, "tag name cannot contain such characters: " + tagName);
    }
    try {
      tagName = decodeURIComponent(tagName);
    } catch (err) {
      throwError(state, "tag name is malformed: " + tagName);
    }
    if (isVerbatim) {
      state.tag = tagName;
    } else if (_hasOwnProperty.call(state.tagMap, tagHandle)) {
      state.tag = state.tagMap[tagHandle] + tagName;
    } else if (tagHandle === "!") {
      state.tag = "!" + tagName;
    } else if (tagHandle === "!!") {
      state.tag = "tag:yaml.org,2002:" + tagName;
    } else {
      throwError(state, 'undeclared tag handle "' + tagHandle + '"');
    }
    return true;
  }
  function readAnchorProperty(state) {
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 38) return false;
    if (state.anchor !== null) {
      throwError(state, "duplication of an anchor property");
    }
    ch = state.input.charCodeAt(++state.position);
    const _position = state.position;
    while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    if (state.position === _position) {
      throwError(state, "name of an anchor node must contain at least one character");
    }
    state.anchor = state.input.slice(_position, state.position);
    return true;
  }
  function readAlias(state) {
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 42) return false;
    ch = state.input.charCodeAt(++state.position);
    const _position = state.position;
    while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    if (state.position === _position) {
      throwError(state, "name of an alias node must contain at least one character");
    }
    const alias = state.input.slice(_position, state.position);
    if (!_hasOwnProperty.call(state.anchorMap, alias)) {
      throwError(state, 'unidentified alias "' + alias + '"');
    }
    state.result = state.anchorMap[alias];
    skipSeparationSpace(state, true, -1);
    return true;
  }
  function tryReadBlockMappingFromProperty(state, propertyStart, nodeIndent, flowIndent) {
    const fallbackState = snapshotState(state);
    beginAnchorTransaction(state);
    restoreState(state, propertyStart);
    state.tag = null;
    state.anchor = null;
    state.kind = null;
    state.result = null;
    if (readBlockMapping(state, nodeIndent, flowIndent) && state.kind === "mapping") {
      commitAnchorTransaction(state);
      return true;
    }
    rollbackAnchorTransaction(state);
    restoreState(state, fallbackState);
    return false;
  }
  function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
    let allowBlockScalars;
    let allowBlockCollections;
    let indentStatus = 1;
    let atNewLine = false;
    let hasContent = false;
    let propertyStart = null;
    let type2;
    let flowIndent;
    let blockIndent;
    if (state.depth >= state.maxDepth) {
      throwError(state, "nesting exceeded maxDepth (" + state.maxDepth + ")");
    }
    state.depth += 1;
    if (state.listener !== null) {
      state.listener("open", state);
    }
    state.tag = null;
    state.anchor = null;
    state.kind = null;
    state.result = null;
    const allowBlockStyles = allowBlockScalars = allowBlockCollections = CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
    if (allowToSeek) {
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        if (state.lineIndent > parentIndent) {
          indentStatus = 1;
        } else if (state.lineIndent === parentIndent) {
          indentStatus = 0;
        } else if (state.lineIndent < parentIndent) {
          indentStatus = -1;
        }
      }
    }
    if (indentStatus === 1) {
      while (true) {
        const ch = state.input.charCodeAt(state.position);
        const propertyState = snapshotState(state);
        if (atNewLine && (ch === 33 && state.tag !== null || ch === 38 && state.anchor !== null)) {
          break;
        }
        if (!readTagProperty(state) && !readAnchorProperty(state)) {
          break;
        }
        if (propertyStart === null) {
          propertyStart = propertyState;
        }
        if (skipSeparationSpace(state, true, -1)) {
          atNewLine = true;
          allowBlockCollections = allowBlockStyles;
          if (state.lineIndent > parentIndent) {
            indentStatus = 1;
          } else if (state.lineIndent === parentIndent) {
            indentStatus = 0;
          } else if (state.lineIndent < parentIndent) {
            indentStatus = -1;
          }
        } else {
          allowBlockCollections = false;
        }
      }
    }
    if (allowBlockCollections) {
      allowBlockCollections = atNewLine || allowCompact;
    }
    if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
      if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
        flowIndent = parentIndent;
      } else {
        flowIndent = parentIndent + 1;
      }
      blockIndent = state.position - state.lineStart;
      if (indentStatus === 1) {
        if (allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent)) || readFlowCollection(state, flowIndent)) {
          hasContent = true;
        } else {
          const ch = state.input.charCodeAt(state.position);
          if (propertyStart !== null && allowBlockStyles && !allowBlockCollections && ch !== 124 && ch !== 62 && tryReadBlockMappingFromProperty(
            state,
            propertyStart,
            propertyStart.position - propertyStart.lineStart,
            flowIndent
          )) {
            hasContent = true;
          } else if (allowBlockScalars && readBlockScalar(state, flowIndent) || readSingleQuotedScalar(state, flowIndent) || readDoubleQuotedScalar(state, flowIndent)) {
            hasContent = true;
          } else if (readAlias(state)) {
            hasContent = true;
            if (state.tag !== null || state.anchor !== null) {
              throwError(state, "alias node should not have any properties");
            }
          } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
            hasContent = true;
            if (state.tag === null) {
              state.tag = "?";
            }
          }
          if (state.anchor !== null) {
            storeAnchor(state, state.anchor, state.result);
          }
        }
      } else if (indentStatus === 0) {
        hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
      }
    }
    if (state.tag === null) {
      if (state.anchor !== null) {
        storeAnchor(state, state.anchor, state.result);
      }
    } else if (state.tag === "?") {
      if (state.result !== null && state.kind !== "scalar") {
        throwError(state, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"');
      }
      for (let typeIndex = 0, typeQuantity = state.implicitTypes.length; typeIndex < typeQuantity; typeIndex += 1) {
        type2 = state.implicitTypes[typeIndex];
        if (type2.resolve(state.result)) {
          state.result = type2.construct(state.result);
          state.tag = type2.tag;
          if (state.anchor !== null) {
            storeAnchor(state, state.anchor, state.result);
          }
          break;
        }
      }
    } else if (state.tag !== "!") {
      if (_hasOwnProperty.call(state.typeMap[state.kind || "fallback"], state.tag)) {
        type2 = state.typeMap[state.kind || "fallback"][state.tag];
      } else {
        type2 = null;
        const typeList = state.typeMap.multi[state.kind || "fallback"];
        for (let typeIndex = 0, typeQuantity = typeList.length; typeIndex < typeQuantity; typeIndex += 1) {
          if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
            type2 = typeList[typeIndex];
            break;
          }
        }
      }
      if (!type2) {
        throwError(state, "unknown tag !<" + state.tag + ">");
      }
      if (state.result !== null && type2.kind !== state.kind) {
        throwError(state, "unacceptable node kind for !<" + state.tag + '> tag; it should be "' + type2.kind + '", not "' + state.kind + '"');
      }
      if (!type2.resolve(state.result, state.tag)) {
        throwError(state, "cannot resolve a node with !<" + state.tag + "> explicit tag");
      } else {
        state.result = type2.construct(state.result, state.tag);
        if (state.anchor !== null) {
          storeAnchor(state, state.anchor, state.result);
        }
      }
    }
    if (state.listener !== null) {
      state.listener("close", state);
    }
    state.depth -= 1;
    return state.tag !== null || state.anchor !== null || hasContent;
  }
  function readDocument(state) {
    const documentStart = state.position;
    let hasDirectives = false;
    let ch;
    state.version = null;
    state.checkLineBreaks = state.legacy;
    state.tagMap = /* @__PURE__ */ Object.create(null);
    state.anchorMap = /* @__PURE__ */ Object.create(null);
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
      if (state.lineIndent > 0 || ch !== 37) {
        break;
      }
      hasDirectives = true;
      ch = state.input.charCodeAt(++state.position);
      let _position = state.position;
      while (ch !== 0 && !isWsOrEol(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      const directiveName = state.input.slice(_position, state.position);
      const directiveArgs = [];
      if (directiveName.length < 1) {
        throwError(state, "directive name must not be less than one character in length");
      }
      while (ch !== 0) {
        while (isWhiteSpace(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        if (ch === 35) {
          do {
            ch = state.input.charCodeAt(++state.position);
          } while (ch !== 0 && !isEol(ch));
          break;
        }
        if (isEol(ch)) break;
        _position = state.position;
        while (ch !== 0 && !isWsOrEol(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        directiveArgs.push(state.input.slice(_position, state.position));
      }
      if (ch !== 0) readLineBreak(state);
      if (_hasOwnProperty.call(directiveHandlers, directiveName)) {
        directiveHandlers[directiveName](state, directiveName, directiveArgs);
      } else {
        throwWarning(state, 'unknown document directive "' + directiveName + '"');
      }
    }
    skipSeparationSpace(state, true, -1);
    if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45) {
      state.position += 3;
      skipSeparationSpace(state, true, -1);
    } else if (hasDirectives) {
      throwError(state, "directives end mark is expected");
    }
    composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
    skipSeparationSpace(state, true, -1);
    if (state.checkLineBreaks && PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) {
      throwWarning(state, "non-ASCII line breaks are interpreted as content");
    }
    state.documents.push(state.result);
    if (state.position === state.lineStart && testDocumentSeparator(state)) {
      if (state.input.charCodeAt(state.position) === 46) {
        state.position += 3;
        skipSeparationSpace(state, true, -1);
      }
      return;
    }
    if (state.position < state.length - 1) {
      throwError(state, "end of the stream or a document separator is expected");
    }
  }
  function loadDocuments(input, options) {
    input = String(input);
    options = options || {};
    if (input.length !== 0) {
      if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13) {
        input += "\n";
      }
      if (input.charCodeAt(0) === 65279) {
        input = input.slice(1);
      }
    }
    const state = new State(input, options);
    const nullpos = input.indexOf("\0");
    if (nullpos !== -1) {
      state.position = nullpos;
      throwError(state, "null byte is not allowed in input");
    }
    state.input += "\0";
    while (state.input.charCodeAt(state.position) === 32) {
      state.lineIndent += 1;
      state.position += 1;
    }
    while (state.position < state.length - 1) {
      readDocument(state);
    }
    return state.documents;
  }
  function loadAll2(input, iterator, options) {
    if (iterator !== null && typeof iterator === "object" && typeof options === "undefined") {
      options = iterator;
      iterator = null;
    }
    const documents = loadDocuments(input, options);
    if (typeof iterator !== "function") {
      return documents;
    }
    for (let index = 0, length = documents.length; index < length; index += 1) {
      iterator(documents[index]);
    }
  }
  function load2(input, options) {
    const documents = loadDocuments(input, options);
    if (documents.length === 0) {
      return void 0;
    } else if (documents.length === 1) {
      return documents[0];
    }
    throw new YAMLException2("expected a single document in the stream, but found more");
  }
  loader.loadAll = loadAll2;
  loader.load = load2;
  return loader;
}
var dumper = {};
var hasRequiredDumper;
function requireDumper() {
  if (hasRequiredDumper) return dumper;
  hasRequiredDumper = 1;
  const common2 = requireCommon();
  const YAMLException2 = requireException();
  const DEFAULT_SCHEMA2 = require_default();
  const _toString = Object.prototype.toString;
  const _hasOwnProperty = Object.prototype.hasOwnProperty;
  const CHAR_BOM = 65279;
  const CHAR_TAB = 9;
  const CHAR_LINE_FEED = 10;
  const CHAR_CARRIAGE_RETURN = 13;
  const CHAR_SPACE = 32;
  const CHAR_EXCLAMATION = 33;
  const CHAR_DOUBLE_QUOTE = 34;
  const CHAR_SHARP = 35;
  const CHAR_PERCENT = 37;
  const CHAR_AMPERSAND = 38;
  const CHAR_SINGLE_QUOTE = 39;
  const CHAR_ASTERISK = 42;
  const CHAR_COMMA = 44;
  const CHAR_MINUS = 45;
  const CHAR_COLON = 58;
  const CHAR_EQUALS = 61;
  const CHAR_GREATER_THAN = 62;
  const CHAR_QUESTION = 63;
  const CHAR_COMMERCIAL_AT = 64;
  const CHAR_LEFT_SQUARE_BRACKET = 91;
  const CHAR_RIGHT_SQUARE_BRACKET = 93;
  const CHAR_GRAVE_ACCENT = 96;
  const CHAR_LEFT_CURLY_BRACKET = 123;
  const CHAR_VERTICAL_LINE = 124;
  const CHAR_RIGHT_CURLY_BRACKET = 125;
  const ESCAPE_SEQUENCES = {};
  ESCAPE_SEQUENCES[0] = "\\0";
  ESCAPE_SEQUENCES[7] = "\\a";
  ESCAPE_SEQUENCES[8] = "\\b";
  ESCAPE_SEQUENCES[9] = "\\t";
  ESCAPE_SEQUENCES[10] = "\\n";
  ESCAPE_SEQUENCES[11] = "\\v";
  ESCAPE_SEQUENCES[12] = "\\f";
  ESCAPE_SEQUENCES[13] = "\\r";
  ESCAPE_SEQUENCES[27] = "\\e";
  ESCAPE_SEQUENCES[34] = '\\"';
  ESCAPE_SEQUENCES[92] = "\\\\";
  ESCAPE_SEQUENCES[133] = "\\N";
  ESCAPE_SEQUENCES[160] = "\\_";
  ESCAPE_SEQUENCES[8232] = "\\L";
  ESCAPE_SEQUENCES[8233] = "\\P";
  const DEPRECATED_BOOLEANS_SYNTAX = [
    "y",
    "Y",
    "yes",
    "Yes",
    "YES",
    "on",
    "On",
    "ON",
    "n",
    "N",
    "no",
    "No",
    "NO",
    "off",
    "Off",
    "OFF"
  ];
  const DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
  function compileStyleMap(schema2, map2) {
    if (map2 === null) return {};
    const result = {};
    const keys = Object.keys(map2);
    for (let index = 0, length = keys.length; index < length; index += 1) {
      let tag = keys[index];
      let style = String(map2[tag]);
      if (tag.slice(0, 2) === "!!") {
        tag = "tag:yaml.org,2002:" + tag.slice(2);
      }
      const type2 = schema2.compiledTypeMap["fallback"][tag];
      if (type2 && _hasOwnProperty.call(type2.styleAliases, style)) {
        style = type2.styleAliases[style];
      }
      result[tag] = style;
    }
    return result;
  }
  function encodeHex(character) {
    let handle;
    let length;
    const string = character.toString(16).toUpperCase();
    if (character <= 255) {
      handle = "x";
      length = 2;
    } else if (character <= 65535) {
      handle = "u";
      length = 4;
    } else if (character <= 4294967295) {
      handle = "U";
      length = 8;
    } else {
      throw new YAMLException2("code point within a string may not be greater than 0xFFFFFFFF");
    }
    return "\\" + handle + common2.repeat("0", length - string.length) + string;
  }
  const QUOTING_TYPE_SINGLE = 1;
  const QUOTING_TYPE_DOUBLE = 2;
  function State(options) {
    this.schema = options["schema"] || DEFAULT_SCHEMA2;
    this.indent = Math.max(1, options["indent"] || 2);
    this.noArrayIndent = options["noArrayIndent"] || false;
    this.skipInvalid = options["skipInvalid"] || false;
    this.flowLevel = common2.isNothing(options["flowLevel"]) ? -1 : options["flowLevel"];
    this.styleMap = compileStyleMap(this.schema, options["styles"] || null);
    this.sortKeys = options["sortKeys"] || false;
    this.lineWidth = options["lineWidth"] || 80;
    this.noRefs = options["noRefs"] || false;
    this.noCompatMode = options["noCompatMode"] || false;
    this.condenseFlow = options["condenseFlow"] || false;
    this.quotingType = options["quotingType"] === '"' ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
    this.forceQuotes = options["forceQuotes"] || false;
    this.replacer = typeof options["replacer"] === "function" ? options["replacer"] : null;
    this.implicitTypes = this.schema.compiledImplicit;
    this.explicitTypes = this.schema.compiledExplicit;
    this.tag = null;
    this.result = "";
    this.duplicates = [];
    this.usedDuplicates = null;
  }
  function indentString(string, spaces) {
    const ind = common2.repeat(" ", spaces);
    let position = 0;
    let result = "";
    const length = string.length;
    while (position < length) {
      let line;
      const next = string.indexOf("\n", position);
      if (next === -1) {
        line = string.slice(position);
        position = length;
      } else {
        line = string.slice(position, next + 1);
        position = next + 1;
      }
      if (line.length && line !== "\n") result += ind;
      result += line;
    }
    return result;
  }
  function generateNextLine(state, level) {
    return "\n" + common2.repeat(" ", state.indent * level);
  }
  function testImplicitResolving(state, str2) {
    for (let index = 0, length = state.implicitTypes.length; index < length; index += 1) {
      const type2 = state.implicitTypes[index];
      if (type2.resolve(str2)) {
        return true;
      }
    }
    return false;
  }
  function isWhitespace(c2) {
    return c2 === CHAR_SPACE || c2 === CHAR_TAB;
  }
  function isPrintable(c2) {
    return c2 >= 32 && c2 <= 126 || c2 >= 161 && c2 <= 55295 && c2 !== 8232 && c2 !== 8233 || c2 >= 57344 && c2 <= 65533 && c2 !== CHAR_BOM || c2 >= 65536 && c2 <= 1114111;
  }
  function isNsCharOrWhitespace(c2) {
    return isPrintable(c2) && c2 !== CHAR_BOM && // - b-char
    c2 !== CHAR_CARRIAGE_RETURN && c2 !== CHAR_LINE_FEED;
  }
  function isPlainSafe(c2, prev, inblock) {
    const cIsNsCharOrWhitespace = isNsCharOrWhitespace(c2);
    const cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c2);
    return (
      // ns-plain-safe
      (inblock ? cIsNsCharOrWhitespace : cIsNsCharOrWhitespace && // - c-flow-indicator
      c2 !== CHAR_COMMA && c2 !== CHAR_LEFT_SQUARE_BRACKET && c2 !== CHAR_RIGHT_SQUARE_BRACKET && c2 !== CHAR_LEFT_CURLY_BRACKET && c2 !== CHAR_RIGHT_CURLY_BRACKET) && // ns-plain-char
      c2 !== CHAR_SHARP && // false on '#'
      !(prev === CHAR_COLON && !cIsNsChar) || // false on ': '
      isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c2 === CHAR_SHARP || // change to true on '[^ ]#'
      prev === CHAR_COLON && cIsNsChar
    );
  }
  function isPlainSafeFirst(c2) {
    return isPrintable(c2) && c2 !== CHAR_BOM && !isWhitespace(c2) && // - s-white
    // - (c-indicator ::=
    // “-” | “?” | “:” | “,” | “[” | “]” | “{” | “}”
    c2 !== CHAR_MINUS && c2 !== CHAR_QUESTION && c2 !== CHAR_COLON && c2 !== CHAR_COMMA && c2 !== CHAR_LEFT_SQUARE_BRACKET && c2 !== CHAR_RIGHT_SQUARE_BRACKET && c2 !== CHAR_LEFT_CURLY_BRACKET && c2 !== CHAR_RIGHT_CURLY_BRACKET && // | “#” | “&” | “*” | “!” | “|” | “=” | “>” | “'” | “"”
    c2 !== CHAR_SHARP && c2 !== CHAR_AMPERSAND && c2 !== CHAR_ASTERISK && c2 !== CHAR_EXCLAMATION && c2 !== CHAR_VERTICAL_LINE && c2 !== CHAR_EQUALS && c2 !== CHAR_GREATER_THAN && c2 !== CHAR_SINGLE_QUOTE && c2 !== CHAR_DOUBLE_QUOTE && // | “%” | “@” | “`”)
    c2 !== CHAR_PERCENT && c2 !== CHAR_COMMERCIAL_AT && c2 !== CHAR_GRAVE_ACCENT;
  }
  function isPlainSafeLast(c2) {
    return !isWhitespace(c2) && c2 !== CHAR_COLON;
  }
  function codePointAt(string, pos) {
    const first = string.charCodeAt(pos);
    let second;
    if (first >= 55296 && first <= 56319 && pos + 1 < string.length) {
      second = string.charCodeAt(pos + 1);
      if (second >= 56320 && second <= 57343) {
        return (first - 55296) * 1024 + second - 56320 + 65536;
      }
    }
    return first;
  }
  function needIndentIndicator(string) {
    const leadingSpaceRe = /^\n* /;
    return leadingSpaceRe.test(string);
  }
  const STYLE_PLAIN = 1;
  const STYLE_SINGLE = 2;
  const STYLE_LITERAL = 3;
  const STYLE_FOLDED = 4;
  const STYLE_DOUBLE = 5;
  function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType, quotingType, forceQuotes, inblock) {
    let i;
    let char = 0;
    let prevChar = null;
    let hasLineBreak = false;
    let hasFoldableLine = false;
    const shouldTrackWidth = lineWidth !== -1;
    let previousLineBreak = -1;
    let plain = isPlainSafeFirst(codePointAt(string, 0)) && isPlainSafeLast(codePointAt(string, string.length - 1));
    if (singleLineOnly || forceQuotes) {
      for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
        char = codePointAt(string, i);
        if (!isPrintable(char)) {
          return STYLE_DOUBLE;
        }
        plain = plain && isPlainSafe(char, prevChar, inblock);
        prevChar = char;
      }
    } else {
      for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
        char = codePointAt(string, i);
        if (char === CHAR_LINE_FEED) {
          hasLineBreak = true;
          if (shouldTrackWidth) {
            hasFoldableLine = hasFoldableLine || // Foldable line = too long, and not more-indented.
            i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
            previousLineBreak = i;
          }
        } else if (!isPrintable(char)) {
          return STYLE_DOUBLE;
        }
        plain = plain && isPlainSafe(char, prevChar, inblock);
        prevChar = char;
      }
      hasFoldableLine = hasFoldableLine || shouldTrackWidth && (i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ");
    }
    if (!hasLineBreak && !hasFoldableLine) {
      if (plain && !forceQuotes && !testAmbiguousType(string)) {
        return STYLE_PLAIN;
      }
      return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
    }
    if (indentPerLevel > 9 && needIndentIndicator(string)) {
      return STYLE_DOUBLE;
    }
    if (!forceQuotes) {
      return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
    }
    return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
  }
  function writeScalar(state, string, level, iskey, inblock) {
    state.dump = (function() {
      if (string.length === 0) {
        return state.quotingType === QUOTING_TYPE_DOUBLE ? '""' : "''";
      }
      if (!state.noCompatMode) {
        if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) {
          return state.quotingType === QUOTING_TYPE_DOUBLE ? '"' + string + '"' : "'" + string + "'";
        }
      }
      const indent = state.indent * Math.max(1, level);
      const lineWidth = state.lineWidth === -1 ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
      const singleLineOnly = iskey || // No block styles in flow mode.
      state.flowLevel > -1 && level >= state.flowLevel;
      function testAmbiguity(string2) {
        return testImplicitResolving(state, string2);
      }
      switch (chooseScalarStyle(
        string,
        singleLineOnly,
        state.indent,
        lineWidth,
        testAmbiguity,
        state.quotingType,
        state.forceQuotes && !iskey,
        inblock
      )) {
        case STYLE_PLAIN:
          return string;
        case STYLE_SINGLE:
          return "'" + string.replace(/'/g, "''") + "'";
        case STYLE_LITERAL:
          return "|" + blockHeader(string, state.indent) + dropEndingNewline(indentString(string, indent));
        case STYLE_FOLDED:
          return ">" + blockHeader(string, state.indent) + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
        case STYLE_DOUBLE:
          return '"' + escapeString(string) + '"';
        default:
          throw new YAMLException2("impossible error: invalid scalar style");
      }
    })();
  }
  function blockHeader(string, indentPerLevel) {
    const indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : "";
    const clip = string[string.length - 1] === "\n";
    const keep = clip && (string[string.length - 2] === "\n" || string === "\n");
    const chomp = keep ? "+" : clip ? "" : "-";
    return indentIndicator + chomp + "\n";
  }
  function dropEndingNewline(string) {
    return string[string.length - 1] === "\n" ? string.slice(0, -1) : string;
  }
  function foldString(string, width) {
    const lineRe = /(\n+)([^\n]*)/g;
    let result = (function() {
      let nextLF = string.indexOf("\n");
      nextLF = nextLF !== -1 ? nextLF : string.length;
      lineRe.lastIndex = nextLF;
      return foldLine(string.slice(0, nextLF), width);
    })();
    let prevMoreIndented = string[0] === "\n" || string[0] === " ";
    let moreIndented;
    let match;
    while (match = lineRe.exec(string)) {
      const prefix = match[1];
      const line = match[2];
      moreIndented = line[0] === " ";
      result += prefix + (!prevMoreIndented && !moreIndented && line !== "" ? "\n" : "") + foldLine(line, width);
      prevMoreIndented = moreIndented;
    }
    return result;
  }
  function foldLine(line, width) {
    if (line === "" || line[0] === " ") return line;
    const breakRe = / [^ ]/g;
    let match;
    let start = 0;
    let end;
    let curr = 0;
    let next = 0;
    let result = "";
    while (match = breakRe.exec(line)) {
      next = match.index;
      if (next - start > width) {
        end = curr > start ? curr : next;
        result += "\n" + line.slice(start, end);
        start = end + 1;
      }
      curr = next;
    }
    result += "\n";
    if (line.length - start > width && curr > start) {
      result += line.slice(start, curr) + "\n" + line.slice(curr + 1);
    } else {
      result += line.slice(start);
    }
    return result.slice(1);
  }
  function escapeString(string) {
    let result = "";
    let char = 0;
    for (let i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
      char = codePointAt(string, i);
      const escapeSeq = ESCAPE_SEQUENCES[char];
      if (!escapeSeq && isPrintable(char)) {
        result += string[i];
        if (char >= 65536) result += string[i + 1];
      } else {
        result += escapeSeq || encodeHex(char);
      }
    }
    return result;
  }
  function writeFlowSequence(state, level, object) {
    let _result = "";
    const _tag = state.tag;
    for (let index = 0, length = object.length; index < length; index += 1) {
      let value = object[index];
      if (state.replacer) {
        value = state.replacer.call(object, String(index), value);
      }
      if (writeNode(state, level, value, false, false) || typeof value === "undefined" && writeNode(state, level, null, false, false)) {
        if (_result !== "") _result += "," + (!state.condenseFlow ? " " : "");
        _result += state.dump;
      }
    }
    state.tag = _tag;
    state.dump = "[" + _result + "]";
  }
  function writeBlockSequence(state, level, object, compact) {
    let _result = "";
    const _tag = state.tag;
    for (let index = 0, length = object.length; index < length; index += 1) {
      let value = object[index];
      if (state.replacer) {
        value = state.replacer.call(object, String(index), value);
      }
      if (writeNode(state, level + 1, value, true, true, false, true) || typeof value === "undefined" && writeNode(state, level + 1, null, true, true, false, true)) {
        if (!compact || _result !== "") {
          _result += generateNextLine(state, level);
        }
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
          _result += "-";
        } else {
          _result += "- ";
        }
        _result += state.dump;
      }
    }
    state.tag = _tag;
    state.dump = _result || "[]";
  }
  function writeFlowMapping(state, level, object) {
    let _result = "";
    const _tag = state.tag;
    const objectKeyList = Object.keys(object);
    for (let index = 0, length = objectKeyList.length; index < length; index += 1) {
      let pairBuffer = "";
      if (_result !== "") pairBuffer += ", ";
      if (state.condenseFlow) pairBuffer += '"';
      const objectKey = objectKeyList[index];
      let objectValue = object[objectKey];
      if (state.replacer) {
        objectValue = state.replacer.call(object, objectKey, objectValue);
      }
      if (!writeNode(state, level, objectKey, false, false)) {
        continue;
      }
      if (state.dump.length > 1024) pairBuffer += "? ";
      pairBuffer += state.dump + (state.condenseFlow ? '"' : "") + ":" + (state.condenseFlow ? "" : " ");
      if (!writeNode(state, level, objectValue, false, false)) {
        continue;
      }
      pairBuffer += state.dump;
      _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = "{" + _result + "}";
  }
  function writeBlockMapping(state, level, object, compact) {
    let _result = "";
    const _tag = state.tag;
    const objectKeyList = Object.keys(object);
    if (state.sortKeys === true) {
      objectKeyList.sort();
    } else if (typeof state.sortKeys === "function") {
      objectKeyList.sort(state.sortKeys);
    } else if (state.sortKeys) {
      throw new YAMLException2("sortKeys must be a boolean or a function");
    }
    for (let index = 0, length = objectKeyList.length; index < length; index += 1) {
      let pairBuffer = "";
      if (!compact || _result !== "") {
        pairBuffer += generateNextLine(state, level);
      }
      const objectKey = objectKeyList[index];
      let objectValue = object[objectKey];
      if (state.replacer) {
        objectValue = state.replacer.call(object, objectKey, objectValue);
      }
      if (!writeNode(state, level + 1, objectKey, true, true, true)) {
        continue;
      }
      const explicitPair = state.tag !== null && state.tag !== "?" || state.dump && state.dump.length > 1024;
      if (explicitPair) {
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
          pairBuffer += "?";
        } else {
          pairBuffer += "? ";
        }
      }
      pairBuffer += state.dump;
      if (explicitPair) {
        pairBuffer += generateNextLine(state, level);
      }
      if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
        continue;
      }
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        pairBuffer += ":";
      } else {
        pairBuffer += ": ";
      }
      pairBuffer += state.dump;
      _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = _result || "{}";
  }
  function detectType(state, object, explicit) {
    const typeList = explicit ? state.explicitTypes : state.implicitTypes;
    for (let index = 0, length = typeList.length; index < length; index += 1) {
      const type2 = typeList[index];
      if ((type2.instanceOf || type2.predicate) && (!type2.instanceOf || typeof object === "object" && object instanceof type2.instanceOf) && (!type2.predicate || type2.predicate(object))) {
        if (explicit) {
          if (type2.multi && type2.representName) {
            state.tag = type2.representName(object);
          } else {
            state.tag = type2.tag;
          }
        } else {
          state.tag = "?";
        }
        if (type2.represent) {
          const style = state.styleMap[type2.tag] || type2.defaultStyle;
          let _result;
          if (_toString.call(type2.represent) === "[object Function]") {
            _result = type2.represent(object, style);
          } else if (_hasOwnProperty.call(type2.represent, style)) {
            _result = type2.represent[style](object, style);
          } else {
            throw new YAMLException2("!<" + type2.tag + '> tag resolver accepts not "' + style + '" style');
          }
          state.dump = _result;
        }
        return true;
      }
    }
    return false;
  }
  function writeNode(state, level, object, block, compact, iskey, isblockseq) {
    state.tag = null;
    state.dump = object;
    if (!detectType(state, object, false)) {
      detectType(state, object, true);
    }
    const type2 = _toString.call(state.dump);
    const inblock = block;
    if (block) {
      block = state.flowLevel < 0 || state.flowLevel > level;
    }
    const objectOrArray = type2 === "[object Object]" || type2 === "[object Array]";
    let duplicateIndex;
    let duplicate;
    if (objectOrArray) {
      duplicateIndex = state.duplicates.indexOf(object);
      duplicate = duplicateIndex !== -1;
    }
    if (state.tag !== null && state.tag !== "?" || duplicate || state.indent !== 2 && level > 0) {
      compact = false;
    }
    if (duplicate && state.usedDuplicates[duplicateIndex]) {
      state.dump = "*ref_" + duplicateIndex;
    } else {
      if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
        state.usedDuplicates[duplicateIndex] = true;
      }
      if (type2 === "[object Object]") {
        if (block && Object.keys(state.dump).length !== 0) {
          writeBlockMapping(state, level, state.dump, compact);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + state.dump;
          }
        } else {
          writeFlowMapping(state, level, state.dump);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + " " + state.dump;
          }
        }
      } else if (type2 === "[object Array]") {
        if (block && state.dump.length !== 0) {
          if (state.noArrayIndent && !isblockseq && level > 0) {
            writeBlockSequence(state, level - 1, state.dump, compact);
          } else {
            writeBlockSequence(state, level, state.dump, compact);
          }
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + state.dump;
          }
        } else {
          writeFlowSequence(state, level, state.dump);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + " " + state.dump;
          }
        }
      } else if (type2 === "[object String]") {
        if (state.tag !== "?") {
          writeScalar(state, state.dump, level, iskey, inblock);
        }
      } else if (type2 === "[object Undefined]") {
        return false;
      } else {
        if (state.skipInvalid) return false;
        throw new YAMLException2("unacceptable kind of an object to dump " + type2);
      }
      if (state.tag !== null && state.tag !== "?") {
        let tagStr = encodeURI(
          state.tag[0] === "!" ? state.tag.slice(1) : state.tag
        ).replace(/!/g, "%21");
        if (state.tag[0] === "!") {
          tagStr = "!" + tagStr;
        } else if (tagStr.slice(0, 18) === "tag:yaml.org,2002:") {
          tagStr = "!!" + tagStr.slice(18);
        } else {
          tagStr = "!<" + tagStr + ">";
        }
        state.dump = tagStr + " " + state.dump;
      }
    }
    return true;
  }
  function getDuplicateReferences(object, state) {
    const objects = [];
    const duplicatesIndexes = [];
    inspectNode(object, objects, duplicatesIndexes);
    const length = duplicatesIndexes.length;
    for (let index = 0; index < length; index += 1) {
      state.duplicates.push(objects[duplicatesIndexes[index]]);
    }
    state.usedDuplicates = new Array(length);
  }
  function inspectNode(object, objects, duplicatesIndexes) {
    if (object !== null && typeof object === "object") {
      const index = objects.indexOf(object);
      if (index !== -1) {
        if (duplicatesIndexes.indexOf(index) === -1) {
          duplicatesIndexes.push(index);
        }
      } else {
        objects.push(object);
        if (Array.isArray(object)) {
          for (let i = 0, length = object.length; i < length; i += 1) {
            inspectNode(object[i], objects, duplicatesIndexes);
          }
        } else {
          const objectKeyList = Object.keys(object);
          for (let i = 0, length = objectKeyList.length; i < length; i += 1) {
            inspectNode(object[objectKeyList[i]], objects, duplicatesIndexes);
          }
        }
      }
    }
  }
  function dump2(input, options) {
    options = options || {};
    const state = new State(options);
    if (!state.noRefs) getDuplicateReferences(input, state);
    let value = input;
    if (state.replacer) {
      value = state.replacer.call({ "": value }, "", value);
    }
    if (writeNode(state, 0, value, true, true)) return state.dump + "\n";
    return "";
  }
  dumper.dump = dump2;
  return dumper;
}
var hasRequiredJsYaml;
function requireJsYaml() {
  if (hasRequiredJsYaml) return jsYaml;
  hasRequiredJsYaml = 1;
  const loader2 = requireLoader();
  const dumper2 = requireDumper();
  function renamed(from, to) {
    return function() {
      throw new Error("Function yaml." + from + " is removed in js-yaml 4. Use yaml." + to + " instead, which is now safe by default.");
    };
  }
  jsYaml.Type = requireType();
  jsYaml.Schema = requireSchema();
  jsYaml.FAILSAFE_SCHEMA = requireFailsafe();
  jsYaml.JSON_SCHEMA = requireJson();
  jsYaml.CORE_SCHEMA = requireCore();
  jsYaml.DEFAULT_SCHEMA = require_default();
  jsYaml.load = loader2.load;
  jsYaml.loadAll = loader2.loadAll;
  jsYaml.dump = dumper2.dump;
  jsYaml.YAMLException = requireException();
  jsYaml.types = {
    binary: requireBinary(),
    float: requireFloat(),
    map: requireMap(),
    null: require_null(),
    pairs: requirePairs(),
    set: requireSet(),
    timestamp: requireTimestamp(),
    bool: requireBool(),
    int: requireInt(),
    merge: requireMerge(),
    omap: requireOmap(),
    seq: requireSeq(),
    str: requireStr()
  };
  jsYaml.safeLoad = renamed("safeLoad", "load");
  jsYaml.safeLoadAll = renamed("safeLoadAll", "loadAll");
  jsYaml.safeDump = renamed("safeDump", "dump");
  return jsYaml;
}
var jsYamlExports = requireJsYaml();
var yaml = /* @__PURE__ */ getDefaultExportFromCjs(jsYamlExports);
var {
  Type,
  Schema,
  FAILSAFE_SCHEMA,
  JSON_SCHEMA,
  CORE_SCHEMA,
  DEFAULT_SCHEMA,
  load,
  loadAll,
  dump,
  YAMLException,
  types,
  safeLoad,
  safeLoadAll,
  safeDump
} = yaml;

// src/engine/parse.ts
var METHODS = ["get", "put", "post", "delete", "patch", "head", "options", "trace"];
var MAX_INPUT = 5 * 1024 * 1024;
var MAX_DEPTH = 12;
var MAX_FIELDS = 5e3;
function parseDocument(text) {
  if (typeof text !== "string" || !text.trim()) throw new Error("The input is empty.");
  if (text.length > MAX_INPUT) throw new Error("The input is larger than 5 MB. Split the spec or remove unused parts.");
  const t = text.trim();
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      return JSON.parse(t);
    } catch (e) {
      throw new Error("This looks like JSON but does not parse: " + e.message);
    }
  }
  try {
    return yaml.load(t, { schema: yaml.JSON_SCHEMA, json: true });
  } catch (e) {
    throw new Error("The YAML does not parse: " + e.message.split("\n")[0]);
  }
}
function resolvePointer(root, ref) {
  if (typeof ref !== "string" || !ref.startsWith("#/")) return void 0;
  const parts = ref.slice(2).split("/").map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
  let cur = root;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return void 0;
    cur = cur[p];
  }
  return cur;
}
function deref(root, node, seen = /* @__PURE__ */ new Set()) {
  let cur = node;
  let guard = 0;
  while (cur && typeof cur === "object" && typeof cur.$ref === "string" && guard < 20) {
    if (seen.has(cur.$ref)) return {};
    seen.add(cur.$ref);
    const next = resolvePointer(root, cur.$ref);
    if (next === void 0) return {};
    cur = next;
    guard++;
  }
  return cur;
}
function flattenSchema(root, schema2, prefix = "", depth = 0, seen = /* @__PURE__ */ new Set(), out = []) {
  if (!schema2 || typeof schema2 !== "object" || depth > MAX_DEPTH || out.length >= MAX_FIELDS) return out;
  if (typeof schema2.$ref === "string") {
    if (seen.has(schema2.$ref)) return out;
    const nextSeen = new Set(seen);
    nextSeen.add(schema2.$ref);
    return flattenSchema(root, resolvePointer(root, schema2.$ref), prefix, depth + 1, nextSeen, out);
  }
  for (const key of ["allOf", "oneOf", "anyOf"]) {
    if (Array.isArray(schema2[key])) for (const s of schema2[key]) flattenSchema(root, s, prefix, depth + 1, seen, out);
  }
  if (schema2.type === "array" || schema2.items) {
    flattenSchema(root, schema2.items, prefix ? prefix + "[]" : "", depth + 1, seen, out);
  }
  const props = schema2.properties;
  if (props && typeof props === "object") {
    for (const [name, raw] of Object.entries(props)) {
      const s = deref(root, raw);
      const path = prefix ? `${prefix}.${name}` : name;
      out.push({
        path,
        name,
        type: Array.isArray(s?.type) ? s.type.join("|") : s?.type,
        format: s?.format,
        readOnly: !!s?.readOnly,
        writeOnly: !!s?.writeOnly,
        maxLength: typeof s?.maxLength === "number" ? s.maxLength : void 0,
        maximum: typeof s?.maximum === "number" ? s.maximum : void 0,
        enumValues: Array.isArray(s?.enum) ? s.enum : void 0,
        description: typeof s?.description === "string" ? s.description : void 0
      });
      const ref = raw && typeof raw === "object" && typeof raw.$ref === "string" ? raw.$ref : void 0;
      if (ref && seen.has(ref)) continue;
      if (s && (s.properties || s.items || s.allOf || s.oneOf || s.anyOf || s.$ref)) {
        flattenSchema(root, s, path, depth + 1, ref ? new Set(seen).add(ref) : seen, out);
      }
    }
  }
  return out;
}
function schemaIsArray(root, schema2) {
  const s = deref(root, schema2);
  if (!s || typeof s !== "object") return false;
  if (s.type === "array") return true;
  const props = s.properties || {};
  for (const k of ["data", "items", "results", "records", "content"]) {
    const p = deref(root, props[k]);
    if (p && p.type === "array") return true;
  }
  return false;
}
function hasAnyExample(node, depth = 0) {
  if (!node || typeof node !== "object" || depth > 8) return false;
  if ("example" in node || "examples" in node) return true;
  return Object.values(node).some((v) => hasAnyExample(v, depth + 1));
}
function jsonBodySchema(content) {
  if (!content || typeof content !== "object") return void 0;
  const key = Object.keys(content).find((k) => /json/i.test(k)) ?? Object.keys(content).find((k) => /form/i.test(k));
  return key ? content[key]?.schema : void 0;
}
function binaryBody(root, content) {
  if (!content || typeof content !== "object") return false;
  if (Object.keys(content).some((k) => /multipart|octet-stream|image\/|application\/pdf/i.test(k))) return true;
  for (const v of Object.values(content)) {
    const fields = flattenSchema(root, v?.schema);
    if (fields.some((f3) => f3.format === "binary" || f3.format === "byte")) return true;
  }
  return false;
}
function parseSchemes(doc) {
  const out = [];
  const v3 = doc?.components?.securitySchemes;
  const v2 = doc?.securityDefinitions;
  const src = v3 || v2 || {};
  for (const [name, raw] of Object.entries(src)) {
    const s = deref(doc, raw) || {};
    let flows = s.flows;
    if (!flows && s.type === "oauth2" && s.flow) {
      const map2 = { accessCode: "authorizationCode", application: "clientCredentials" };
      flows = { [map2[s.flow] || s.flow]: { scopes: s.scopes, authorizationUrl: s.authorizationUrl, tokenUrl: s.tokenUrl } };
    }
    out.push({
      name,
      type: s.type === "basic" ? "http" : String(s.type || "unknown"),
      scheme: s.type === "basic" ? "basic" : s.scheme ? String(s.scheme).toLowerCase() : void 0,
      in: s.in,
      bearerFormat: s.bearerFormat,
      flows
    });
  }
  return out;
}
function parseServers(doc) {
  if (Array.isArray(doc?.servers)) return doc.servers.map((s) => String(s?.url ?? "")).filter(Boolean);
  if (doc?.host) {
    const schemes = Array.isArray(doc.schemes) && doc.schemes.length ? doc.schemes : ["https"];
    return schemes.map((sc) => `${sc}://${doc.host}${doc.basePath || ""}`);
  }
  return [];
}
function buildApiModel(doc) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) throw new Error("The spec is not an object.");
  const version = String(doc.openapi || doc.swagger || "");
  if (!version) throw new Error('No "openapi" or "swagger" field: this does not look like an OpenAPI document.');
  if (!doc.paths || typeof doc.paths !== "object") throw new Error('The spec has no "paths".');
  const secList = (v) => Array.isArray(v) ? v.filter((r) => r && typeof r === "object" && !Array.isArray(r)) : null;
  const globalSecurity = secList(doc.security);
  const operations = [];
  for (const [path, rawItem] of Object.entries(doc.paths)) {
    const item = deref(doc, rawItem) || {};
    const sharedParams = Array.isArray(item.parameters) ? item.parameters : [];
    for (const method of METHODS) {
      const op = item[method];
      if (!op || typeof op !== "object") continue;
      const params = [];
      const bodyParamsV2 = [];
      const seenParam = /* @__PURE__ */ new Set();
      for (const rawP of [...Array.isArray(op.parameters) ? op.parameters : [], ...sharedParams]) {
        const p = deref(doc, rawP) || {};
        const id = `${p.in}:${p.name}`;
        if (seenParam.has(id)) continue;
        seenParam.add(id);
        if (p.in === "body") {
          bodyParamsV2.push(p);
          continue;
        }
        if (p.in === "formData") {
          bodyParamsV2.push({ schema: { properties: { [p.name]: { type: p.type, format: p.type === "file" ? "binary" : p.format } } } });
          continue;
        }
        if (!["path", "query", "header", "cookie"].includes(p.in)) continue;
        const sch = deref(doc, p.schema) || p;
        params.push({
          name: String(p.name),
          in: p.in,
          required: !!p.required || p.in === "path",
          type: sch?.type,
          format: sch?.format,
          maximum: typeof sch?.maximum === "number" ? sch.maximum : void 0,
          description: p.description
        });
      }
      let requestFields = [];
      let requestAdditionalProps = null;
      let requestHasBinary = false;
      const rb = deref(doc, op.requestBody);
      if (rb?.content) {
        const sch = jsonBodySchema(rb.content);
        if (sch) {
          requestFields = flattenSchema(doc, sch);
          const top = deref(doc, sch);
          if (top && (top.type === "object" || top.properties)) requestAdditionalProps = top.additionalProperties === false ? false : true;
        }
        requestHasBinary = binaryBody(doc, rb.content);
      }
      for (const bp of bodyParamsV2) {
        requestFields = requestFields.concat(flattenSchema(doc, bp.schema));
        const top = deref(doc, bp.schema);
        if (top && (top.type === "object" || top.properties)) requestAdditionalProps = top.additionalProperties === false ? false : true;
        if (flattenSchema(doc, bp.schema).some((f3) => f3.format === "binary")) requestHasBinary = true;
      }
      const responses = op.responses && typeof op.responses === "object" ? op.responses : {};
      const responseCodes = Object.keys(responses);
      let responseFields = [];
      let errorFields = [];
      let responseIsArray = false;
      for (const [code, rawR] of Object.entries(responses)) {
        const r = deref(doc, rawR) || {};
        const sch = r.content ? jsonBodySchema(r.content) : r.schema;
        if (!sch) continue;
        const fields = flattenSchema(doc, sch);
        if (/^2/.test(code)) {
          responseFields = responseFields.concat(fields);
          if (schemaIsArray(doc, sch)) responseIsArray = true;
        } else if (/^[45]/.test(code) || code === "default") {
          errorFields = errorFields.concat(fields);
        }
      }
      const extensions = {};
      for (const [k, v] of Object.entries(op)) if (k.startsWith("x-")) extensions[k.toLowerCase()] = v;
      const key = `${method.toUpperCase()} ${path}`;
      operations.push({
        key,
        method,
        path,
        operationId: typeof op.operationId === "string" ? op.operationId : void 0,
        summary: typeof op.summary === "string" ? op.summary : void 0,
        description: typeof op.description === "string" ? op.description : void 0,
        tags: Array.isArray(op.tags) ? op.tags.map(String) : [],
        params,
        requestFields,
        requestAdditionalProps,
        requestHasBinary,
        responseFields,
        responseIsArray,
        responseCodes,
        errorFields,
        security: secList(op.security) ?? globalSecurity,
        deprecated: !!op.deprecated,
        extensions,
        hasExamples: hasAnyExample(op),
        callbacks: !!op.callbacks && Object.keys(op.callbacks).length > 0
      });
    }
  }
  return {
    title: String(doc.info?.title || "Untitled API"),
    version: String(doc.info?.version || ""),
    openapi: version,
    description: typeof doc.info?.description === "string" ? doc.info.description : void 0,
    hasContact: !!doc.info?.contact,
    servers: parseServers(doc),
    schemes: parseSchemes(doc),
    globalSecurity,
    operations,
    webhooks: doc.webhooks && typeof doc.webhooks === "object" ? Object.keys(doc.webhooks).length : 0
  };
}
function asWritten(text, key, inside) {
  const value = new RegExp(`^${inside ? "[ \\t]+" : ""}${key}:[ \\t]*["']?([^"'#\\r\\n]+?)["']?[ \\t]*(?:#.*)?$`);
  const lines = text.split(/\r?\n/);
  let open = !inside;
  for (const line of lines) {
    if (inside) {
      if (new RegExp(`^${inside}:`).test(line)) {
        open = true;
        continue;
      }
      if (open && /^\S/.test(line)) break;
    }
    if (open) {
      const m = line.match(value);
      if (m) return m[1];
    }
  }
  return void 0;
}
function parseApi(text) {
  const doc = parseDocument(text);
  if (doc && typeof doc === "object" && !Array.isArray(doc)) {
    if (doc.info && typeof doc.info.version === "number") doc.info.version = asWritten(text, "version", "info") ?? String(doc.info.version);
    for (const k of ["openapi", "swagger"]) if (typeof doc[k] === "number") doc[k] = asWritten(text, k) ?? String(doc[k]);
  }
  return buildApiModel(doc);
}
function collectText(node, depth = 0, out = []) {
  if (depth > 10 || node == null) return out;
  if (typeof node === "string") {
    out.push(node);
    return out;
  }
  if (Array.isArray(node)) {
    for (const v of node) collectText(v, depth + 1, out);
    return out;
  }
  if (typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (["description", "title", "default", "examples", "example", "enum", "const", "x-description"].includes(k)) collectText(v, depth + 1, out);
      else if (typeof v === "object") collectText(v, depth + 1, out);
    }
  }
  return out;
}
function toolParams(schema2) {
  const props = schema2?.properties;
  if (!props || typeof props !== "object") return [];
  return Object.entries(props).map(([name, s]) => ({
    name,
    type: s?.type,
    description: typeof s?.description === "string" ? s.description : void 0,
    default: s?.default
  }));
}
function schemaShape(schema2) {
  const hasProps = !!schema2?.properties && typeof schema2.properties === "object" && Object.keys(schema2.properties).length > 0;
  return {
    schemaOpen: hasProps && schema2.additionalProperties !== false,
    required: Array.isArray(schema2?.required) ? schema2.required.map(String) : []
  };
}
function oneTool(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.type === "function" && raw.function && typeof raw.function === "object") {
    const f3 = raw.function;
    if (!f3.name) return null;
    return {
      name: String(f3.name),
      description: String(f3.description ?? ""),
      params: toolParams(f3.parameters),
      scanText: [String(f3.description ?? ""), ...collectText(f3.parameters)].join("\n"),
      ...schemaShape(f3.parameters),
      annotations: {},
      source: "openai"
    };
  }
  if (!raw.name) return null;
  const schema2 = raw.inputSchema ?? raw.input_schema ?? raw.parameters ?? {};
  const source = raw.inputSchema ? "mcp" : raw.input_schema ? "anthropic" : raw.parameters ? "openai" : "plain";
  const ann = raw.annotations && typeof raw.annotations === "object" ? raw.annotations : {};
  return {
    name: String(raw.name),
    description: String(raw.description ?? ""),
    params: toolParams(schema2),
    scanText: [String(raw.title ?? ""), String(raw.description ?? ""), ...collectText(schema2)].join("\n"),
    ...schemaShape(schema2),
    annotations: {
      readOnlyHint: typeof ann.readOnlyHint === "boolean" ? ann.readOnlyHint : void 0,
      destructiveHint: typeof ann.destructiveHint === "boolean" ? ann.destructiveHint : void 0,
      idempotentHint: typeof ann.idempotentHint === "boolean" ? ann.idempotentHint : void 0,
      openWorldHint: typeof ann.openWorldHint === "boolean" ? ann.openWorldHint : void 0
    },
    source
  };
}
function parseTools(text) {
  const doc = parseDocument(text);
  let list;
  if (Array.isArray(doc)) list = doc;
  else if (Array.isArray(doc?.tools)) list = doc.tools;
  else if (Array.isArray(doc?.result?.tools)) list = doc.result.tools;
  else if (Array.isArray(doc?.functions)) list = doc.functions;
  else if (doc && typeof doc === "object" && doc.name) list = [doc];
  if (!list) throw new Error("No tools found. Paste an MCP tools/list result, or an array of OpenAI or Anthropic tool definitions.");
  const tools = list.map(oneTool).filter((t) => !!t);
  if (!tools.length) throw new Error("The list holds no tool with a name.");
  if (tools.length > 500) throw new Error("More than 500 tools: split them by server.");
  return tools;
}

// src/engine/api-checks.ts
var OBJECT_ID = /(^id$|_id$|Id$|^uuid$|Uuid$|^(account|user|customer|order|invoice|card|loan|ticket|document|file|payment|refund|transaction|member|patient|org|tenant|project)(Number|No|Ref)?$)/i;
var SENSITIVE_OUT = /^(password|passwd|pass_?hash|password_?hash|hash|salt|secret|client_?secret|api_?key|apikey|access_?token|refresh_?token|token|otp|mfa_?secret|totp_?secret|pin|cvv|cvc|card_?number|pan|ssn|social_?security(_?number)?|tax_?id|national_?id|private_?key|security_?answer)$/i;
var PRIVILEGED_IN = /^(role|roles|is_?admin|admin|is_?staff|permissions?|scopes?|group|groups|privilege|access_?level|is_?verified|verified|email_?verified|kyc_?status|balance|credit|credit_?limit|price|amount_?paid|discount|status|approved|owner|owner_?id|user_?id|account_?id|tenant_?id|org_?id|plan|tier|is_?premium|limit|daily_?limit)$/i;
var URL_FIELD = /^(url|uri|link|href|callback(_?url)?|webhook(_?url)?|redirect(_?url|_?uri)?|return_?url|next|target|endpoint|image_?url|avatar_?url|feed(_?url)?|source(_?url)?|dest(ination)?(_?url)?|proxy|host)$/i;
var BUSINESS_FLOW = /(refund|payout|transfer|withdraw|payment|pay|checkout|purchase|order|redeem|coupon|voucher|gift|reward|points|vote|signup|sign-up|register|invite|reset|otp|verify|booking|reserve|ticket|bid|loan|credit|limit)/i;
var ADMIN_PATH = /\/(admin|internal|manage|management|staff|ops|backoffice|debug|actuator|system|root|superuser)(\/|$)/i;
var LOGIN_PATH = /(login|signin|sign-in|token|oauth|auth\/|session|password|otp|mfa|2fa)/i;
var PAGING = /^(limit|page_?size|per_?page|size|count|max|max_?results|top|first|take)$/i;
var ERROR_LEAK = /^(stack|stack_?trace|trace|traceback|exception|debug|sql|query|internal_?message|file|line)$/i;
var NON_PROD_HOST = /(dev|staging|stage|test|qa|uat|sandbox|preprod|pre-prod|internal|local)/i;
function isWrite(op) {
  return op.method === "post" || op.method === "put" || op.method === "patch" || op.method === "delete";
}
function isPublic(op) {
  if (op.security === null) return true;
  return op.security.length === 0 || op.security.some((req) => Object.keys(req).length === 0);
}
function scopesOf(op) {
  if (!op.security) return [];
  return [...new Set(op.security.flatMap((req) => Object.values(req).flat()))];
}
function documentsLimit(op) {
  const ext = Object.keys(op.extensions).some((k) => /rate|throttl|limit|quota/.test(k));
  const text = `${op.summary ?? ""} ${op.description ?? ""}`;
  return op.responseCodes.includes("429") || ext || /rate.?limit|throttl|per (minute|hour|day)|quota/i.test(text);
}
function hasIdempotencyKey(op) {
  return op.params.some((p) => p.in === "header" && /idempotency|request-id|x-request-id/i.test(p.name));
}
function f(partial) {
  return { refs: [], ...partial };
}
function fieldList(fields, max = 4) {
  const names = [...new Set(fields.map((x) => x.path))];
  return names.slice(0, max).join(", ") + (names.length > max ? ` and ${names.length - max} more` : "");
}
function checkApi(api) {
  const out = [];
  const ops = api.operations;
  for (const s of api.servers) {
    if (/^http:\/\//i.test(s) && !/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(s)) {
      out.push(f({
        rule: "API8-PLAIN-HTTP",
        area: "api",
        severity: "high",
        title: "A server is listed on plain HTTP",
        where: `server ${s}`,
        detail: "Tokens and response data cross the network unencrypted, so anyone on the path can read or change them.",
        fix: "Serve only over HTTPS, redirect HTTP and send Strict-Transport-Security.",
        refs: [{ standard: API_TOP10.API8 }]
      }));
    }
    if (NON_PROD_HOST.test(s.replace(/^https?:\/\//, "").split("/")[0])) {
      out.push(f({
        rule: "API9-NONPROD-SERVER",
        area: "inventory",
        severity: "medium",
        title: "A non-production server is in the public spec",
        where: `server ${s}`,
        detail: "Staging and test hosts are often weaker than production and are easy to find once they appear in documentation.",
        fix: "Publish production servers only, and keep staging behind the same authentication and gateway rules as production.",
        refs: [{ standard: API_TOP10.API9 }]
      }));
    }
  }
  if (!api.schemes.length) {
    out.push(f({
      rule: "API2-NO-SCHEME",
      area: "auth",
      severity: "high",
      title: "The spec defines no authentication scheme",
      where: "components.securitySchemes",
      detail: "Without a declared scheme, every operation reads as public and nobody can check which endpoints need a token.",
      fix: "Declare the scheme (OAuth 2.0, OpenID Connect or bearer tokens) and apply it globally, opening only the endpoints meant to be public.",
      refs: [{ standard: API_TOP10.API2 }]
    }));
  }
  for (const s of api.schemes) {
    if (s.type === "apiKey" && s.in === "query") {
      out.push(f({
        rule: "API2-KEY-IN-QUERY",
        area: "auth",
        severity: "high",
        title: "An API key travels in the query string",
        where: `scheme ${s.name}`,
        detail: "Query strings end up in server logs, proxy logs, browser history and Referer headers, so the key leaks.",
        fix: "Send the key in a header, or move to short-lived OAuth 2.0 access tokens.",
        refs: [{ standard: API_TOP10.API2 }]
      }));
    }
    if (s.type === "http" && s.scheme === "basic") {
      out.push(f({
        rule: "API2-BASIC",
        area: "auth",
        severity: "medium",
        title: "HTTP Basic authentication sends the password on every call",
        where: `scheme ${s.name}`,
        detail: "The same long-lived secret crosses the wire on every request and cannot be scoped or expired.",
        fix: "Exchange the password once for a short-lived, scoped access token.",
        refs: [{ standard: API_TOP10.API2 }]
      }));
    }
    if (s.type === "apiKey" && s.in !== "query") {
      out.push(f({
        rule: "API2-STATIC-KEY",
        area: "auth",
        severity: "low",
        title: "A static API key identifies the caller",
        where: `scheme ${s.name}`,
        detail: "API keys are shared, copied and rarely rotated; they say which app is calling, not which user.",
        fix: "Use per-user OAuth 2.0 tokens for user data, keep keys for app identification, and rotate them on a schedule.",
        refs: [{ standard: API_TOP10.API2 }]
      }));
    }
    for (const [flow, def] of Object.entries(s.flows ?? {})) {
      if (flow === "implicit") {
        out.push(f({
          rule: "API2-IMPLICIT-FLOW",
          area: "auth",
          severity: "high",
          title: "The OAuth implicit flow is allowed",
          where: `scheme ${s.name}`,
          detail: "The implicit flow returns the access token in the URL fragment, where browser history and scripts can read it. OAuth 2.0 security guidance has deprecated it.",
          fix: "Use the authorization code flow with PKCE.",
          refs: [{ standard: API_TOP10.API2 }]
        }));
      }
      if (flow === "password") {
        out.push(f({
          rule: "API2-PASSWORD-FLOW",
          area: "auth",
          severity: "medium",
          title: "The OAuth password grant is allowed",
          where: `scheme ${s.name}`,
          detail: "The client handles the user's password directly, which defeats the point of delegated authorization.",
          fix: "Use the authorization code flow with PKCE for users and client credentials for services.",
          refs: [{ standard: API_TOP10.API2 }]
        }));
      }
      const scopes2 = Object.keys(def?.scopes ?? {});
      const broad = scopes2.filter((sc) => /(^|[:._-])(\*|all|admin|full|root|write:\*|.*:all)$/i.test(sc) || sc === "*");
      if (broad.length) {
        out.push(f({
          rule: "API2-BROAD-SCOPE",
          area: "auth",
          severity: "medium",
          title: "A scope grants everything at once",
          where: `scheme ${s.name}`,
          evidence: broad.join(", "),
          detail: "A token with an all-powerful scope turns any single leak into full access, and an agent holding it can do anything the API allows.",
          fix: "Split scopes by resource and action (accounts:read, refunds:write) and give each client only what it needs.",
          refs: [{ standard: API_TOP10.API5 }]
        }));
      }
    }
  }
  const versions = /* @__PURE__ */ new Map();
  let undocumented = 0;
  let noErrors = 0;
  for (const op of ops) {
    const where = op.key;
    const pub = isPublic(op);
    const write2 = isWrite(op);
    const pathIds = op.params.filter((p) => p.in === "path" && OBJECT_ID.test(p.name));
    const queryIds = op.params.filter((p) => p.in === "query" && OBJECT_ID.test(p.name));
    const bodyIds = op.requestFields.filter((x) => !x.path.includes(".") && OBJECT_ID.test(x.name));
    const login = LOGIN_PATH.test(op.path);
    const vm = op.path.match(/\/v(\d+)(?=\/|$)/i);
    if (vm) {
      const rest = op.path.replace(/\/v\d+(?=\/|$)/i, "");
      if (!versions.has(rest)) versions.set(rest, /* @__PURE__ */ new Set());
      versions.get(rest).add(vm[1]);
    }
    if (pub && !login && !/health|status|ping|version|docs|openapi|\.well-known/i.test(op.path)) {
      out.push(f({
        rule: "API2-PUBLIC-OP",
        area: "auth",
        severity: write2 ? "critical" : pathIds.length ? "high" : "medium",
        title: write2 ? "A write operation needs no authentication" : "An operation needs no authentication",
        where,
        detail: write2 ? "Anyone on the internet can call this and change data. No security requirement applies to it." : "No security requirement applies, so anyone can call it. Confirm it is meant to be public.",
        fix: "Apply the API's security scheme to this operation, or document why it is public.",
        refs: [{ standard: API_TOP10.API2 }]
      }));
    }
    const ids = [...pathIds, ...queryIds];
    if (ids.length || write2 && bodyIds.length) {
      const names = [...ids.map((p) => p.name), ...bodyIds.map((b) => b.name)];
      const numeric = ids.some((p) => p.type === "integer" || p.format === "int64" || p.format === "int32");
      out.push(f({
        rule: "API1-OWNERSHIP",
        area: "api",
        severity: pub ? "critical" : write2 ? "high" : numeric ? "high" : "medium",
        title: "The caller picks which object to act on",
        where,
        evidence: [...new Set(names)].join(", "),
        detail: `The request names the object by ${[...new Set(names)].join(", ")}. Unless the server checks that this object belongs to the signed-in user, any user (or an agent acting for one) can read or change someone else's.${numeric ? " The id is a number, so neighbouring ids are easy to guess." : ""}`,
        fix: "Check ownership on the server for every request, using the identity in the token, never an id the client sends. Return 404 for objects the caller does not own.",
        refs: [{ standard: API_TOP10.API1 }]
      }));
    }
    const leaks = op.responseFields.filter((x) => SENSITIVE_OUT.test(x.name) && !x.writeOnly);
    if (leaks.length) {
      out.push(f({
        rule: "API3-SENSITIVE-OUT",
        area: "api",
        severity: "high",
        title: "The response carries secrets or regulated data",
        where,
        evidence: fieldList(leaks),
        detail: `The response schema includes ${fieldList(leaks)}. Clients and agents receive more than they show, and an agent may repeat it in an answer.`,
        fix: "Remove these fields from the response model, or mark them writeOnly. Return only the fields the client displays.",
        refs: [{ standard: API_TOP10.API3 }]
      }));
    }
    if (write2 && op.method !== "delete") {
      const priv = op.requestFields.filter((x) => PRIVILEGED_IN.test(x.name) && !x.readOnly);
      if (priv.length) {
        out.push(f({
          rule: "API3-MASS-ASSIGNMENT",
          area: "api",
          severity: "high",
          title: "The request accepts fields a user should not set",
          where,
          evidence: fieldList(priv),
          detail: `Callers may send ${fieldList(priv)}. If the server binds the body straight onto its model, a user can raise their own role, limit or balance.`,
          fix: "Accept an explicit allow-list of fields per operation; mark server-owned fields readOnly and ignore them on input.",
          refs: [{ standard: API_TOP10.API3 }]
        }));
      }
      if (op.requestAdditionalProps === true && op.requestFields.length) {
        out.push(f({
          rule: "API3-OPEN-BODY",
          area: "api",
          severity: "low",
          title: "The request body accepts unknown properties",
          where,
          detail: "additionalProperties is not false, so extra fields pass schema validation and reach the server.",
          fix: "Set additionalProperties: false on request bodies and validate against the schema at the gateway.",
          refs: [{ standard: API_TOP10.API3 }]
        }));
      }
    }
    if (op.method === "get" && op.responseIsArray) {
      const paging = op.params.filter((p) => p.in === "query" && PAGING.test(p.name));
      if (!paging.length) {
        out.push(f({
          rule: "API4-NO-PAGING",
          area: "api",
          severity: "medium",
          title: "A list endpoint has no page size parameter",
          where,
          detail: "Without paging, one call can ask for every record, which is slow for the server and a fast way to copy data out.",
          fix: "Add a limit parameter with a documented maximum and paginate by cursor.",
          refs: [{ standard: API_TOP10.API4 }]
        }));
      } else if (paging.every((p) => p.maximum === void 0)) {
        out.push(f({
          rule: "API4-NO-MAX",
          area: "api",
          severity: "medium",
          title: "The page size has no maximum",
          where,
          evidence: paging.map((p) => p.name).join(", "),
          detail: "Callers choose the page size freely, so limit=1000000 returns everything at once.",
          fix: "Declare a maximum on the parameter and enforce it on the server.",
          refs: [{ standard: API_TOP10.API4 }]
        }));
      }
    }
    if (op.requestHasBinary) {
      out.push(f({
        rule: "API4-UPLOAD",
        area: "api",
        severity: "low",
        title: "An upload has no documented size or type limit",
        where,
        detail: "File uploads without limits let one caller fill storage or send a file type the parser should never see.",
        fix: "Document and enforce the maximum size and the accepted content types; scan uploads before processing.",
        refs: [{ standard: API_TOP10.API4 }]
      }));
    }
    if (login && (op.method === "post" || op.method === "put") && !documentsLimit(op)) {
      out.push(f({
        rule: "API2-LOGIN-RATE",
        area: "auth",
        severity: "high",
        title: "A sign-in or token endpoint shows no rate limit",
        where,
        detail: "Credential endpoints without a limit allow password spraying and brute force against one account.",
        fix: "Limit attempts per account and per IP, return 429 with Retry-After, and document it in the spec.",
        refs: [{ standard: API_TOP10.API2 }]
      }));
    }
    if (ADMIN_PATH.test(op.path)) {
      const scopes2 = scopesOf(op);
      out.push(f({
        rule: "API5-ADMIN-PATH",
        area: "api",
        severity: pub ? "critical" : scopes2.length ? "medium" : "high",
        title: "An administrative function is in the same API",
        where,
        detail: scopes2.length ? `It requires ${scopes2.join(", ")}. Verify that ordinary users can never hold that scope.` : "It requires no special scope, so the only thing between a normal user and this function is the URL.",
        fix: "Require a dedicated admin role or scope, deny by default, and test the call with an ordinary user token.",
        refs: [{ standard: API_TOP10.API5 }]
      }));
    }
    const flowText = `${op.path} ${op.operationId ?? ""}`;
    if (write2 && BUSINESS_FLOW.test(flowText) && !login) {
      const limited = documentsLimit(op);
      const idem = hasIdempotencyKey(op);
      if (!limited || !idem) {
        out.push(f({
          rule: "API6-BUSINESS-FLOW",
          area: "api",
          severity: !limited && !idem ? "high" : "medium",
          title: "A sensitive business flow has no documented limit",
          where,
          detail: `${!limited ? "No rate or volume limit is documented. " : ""}${!idem ? "No idempotency key is accepted, so a retried or replayed call repeats the action. " : ""}Flows like this are abused by repeating them, not by breaking them.`,
          fix: "Cap the flow per user per day in code, require an Idempotency-Key header, and alert on unusual volume.",
          refs: [{ standard: API_TOP10.API6 }]
        }));
      }
    }
    const urlParams = [
      ...op.params.filter((p) => URL_FIELD.test(p.name) || p.format === "uri" || p.format === "url"),
      ...op.requestFields.filter((x) => URL_FIELD.test(x.name) || x.format === "uri" || x.format === "url")
    ];
    if (urlParams.length) {
      out.push(f({
        rule: "API7-URL-INPUT",
        area: "api",
        severity: "medium",
        title: "The caller supplies a URL",
        where,
        evidence: urlParams.map((p) => p.name).join(", "),
        detail: "If the server fetches this URL, a caller can point it at internal addresses such as cloud metadata services or admin panels.",
        fix: "Allow-list the hosts and schemes the server may fetch, block private and link-local ranges after DNS resolution, and never return the raw response.",
        refs: [{ standard: API_TOP10.API7 }]
      }));
    }
    const leaky = op.errorFields.filter((x) => ERROR_LEAK.test(x.name));
    if (leaky.length) {
      out.push(f({
        rule: "API8-ERROR-DETAIL",
        area: "api",
        severity: "medium",
        title: "Error responses carry internal detail",
        where,
        evidence: fieldList(leaky),
        detail: "Stack traces, SQL and file paths in errors give an attacker a map of the server.",
        fix: "Return a stable error code and a short message; keep detail in server logs under a correlation id.",
        refs: [{ standard: API_TOP10.API8 }]
      }));
    }
    if (op.method === "post" && op.responseCodes.includes("409")) {
      out.push(f({
        rule: "SL-409-DISCLOSES",
        area: "docs",
        severity: "info",
        title: "409 Conflict tells a caller the record exists",
        where,
        detail: "On sign-up or create, 409 confirms that an email or name is already taken, which helps enumeration.",
        fix: "Consider 422 with a neutral message, and write the choice into your API standards.",
        refs: []
      }));
    }
    if (op.deprecated) {
      out.push(f({
        rule: "API9-DEPRECATED-LIVE",
        area: "inventory",
        severity: "low",
        title: "A deprecated operation is still published",
        where,
        detail: "Deprecated endpoints keep their old behaviour and often miss the fixes the new version got.",
        fix: "Publish a removal date (Sunset header), then remove the endpoint from the gateway, not only from the docs.",
        refs: [{ standard: API_TOP10.API9 }]
      }));
    }
    if (op.callbacks) {
      out.push(f({
        rule: "API10-CALLBACK",
        area: "api",
        severity: "low",
        title: "The API calls back to URLs it is given",
        where,
        detail: "Data sent to or received from third parties is trusted less carefully than your own.",
        fix: "Sign callbacks, validate everything that comes back, and set timeouts and size limits.",
        refs: [{ standard: API_TOP10.API10 }]
      }));
    }
    if (!op.summary && !op.description) undocumented++;
    if (!op.responseCodes.some((c2) => /^[45]/.test(c2) || c2 === "default")) noErrors++;
  }
  for (const [rest, set2] of versions) {
    if (set2.size > 1) {
      const sorted = [...set2].sort((a, b) => Number(a) - Number(b));
      out.push(f({
        rule: "API9-OLD-VERSION",
        area: "inventory",
        severity: "medium",
        title: "An older API version is still reachable",
        where: `${rest || "/"} (v${sorted.join(", v")})`,
        detail: `Version ${sorted.slice(0, -1).map((v) => "v" + v).join(", ")} is still published beside v${sorted[sorted.length - 1]}. A fix made in the new version does nothing while the old one answers.`,
        fix: "Set a removal date, tell registered consumers, then return 404 for the old version at the gateway.",
        refs: [{ standard: API_TOP10.API9 }]
      }));
    }
  }
  const ratePlanned = ops.some(documentsLimit);
  if (ops.length && !ratePlanned) {
    out.push(f({
      rule: "API4-NO-429",
      area: "api",
      severity: "medium",
      title: "No operation documents a rate limit",
      where: "whole API",
      detail: "No 429 response, rate-limit extension or limit note appears anywhere in the spec.",
      fix: "Rate-limit at the gateway per token and per IP, document the limits, and return 429 with Retry-After.",
      refs: [{ standard: API_TOP10.API4 }]
    }));
  }
  if (ops.length && undocumented / ops.length > 0.2) {
    out.push(f({
      rule: "DOC-UNDESCRIBED",
      area: "docs",
      severity: "low",
      title: `${undocumented} of ${ops.length} operations have no summary or description`,
      where: "whole API",
      detail: "Undocumented operations are the ones nobody reviews, and an agent picks tools by these descriptions.",
      fix: "Give every operation a one-line summary and a description of who may call it and what it changes.",
      refs: [{ standard: API_TOP10.API9 }]
    }));
  }
  if (ops.length && noErrors / ops.length > 0.3) {
    out.push(f({
      rule: "DOC-NO-ERRORS",
      area: "docs",
      severity: "low",
      title: `${noErrors} of ${ops.length} operations document no error response`,
      where: "whole API",
      detail: "Without documented errors, clients guess, and testers cannot tell a correct refusal from a bug.",
      fix: "Document 400, 401 or 404, 403 where used, 422 and 429 with one shared error schema.",
      refs: [{ standard: API_TOP10.API9 }]
    }));
  }
  if (!api.description) {
    out.push(f({
      rule: "DOC-NO-OVERVIEW",
      area: "docs",
      severity: "info",
      title: "The spec has no overview",
      where: "info.description",
      detail: "Concept documentation (what the API is for, how auth works, the main flows) is missing.",
      fix: "Add an overview to info.description covering purpose, authentication, rate limits and versioning.",
      refs: [{ standard: API_TOP10.API9 }]
    }));
  }
  if (!api.hasContact) {
    out.push(f({
      rule: "DOC-NO-OWNER",
      area: "inventory",
      severity: "info",
      title: "The spec names no owner",
      where: "info.contact",
      detail: "An API with no owner in its inventory entry is the one that stays live after everyone has forgotten it.",
      fix: "Add info.contact with the owning team.",
      refs: [{ standard: API_TOP10.API9 }]
    }));
  }
  return out;
}
function docsScore(api) {
  const ops = api.operations;
  const n = Math.max(ops.length, 1);
  const pct = (k) => Math.round(k / n * 100);
  const parts = [
    { label: "Operations with a summary or description", value: pct(ops.filter((o) => o.summary || o.description).length) },
    { label: "Operations with an operationId", value: pct(ops.filter((o) => o.operationId).length) },
    { label: "Operations with a documented error", value: pct(ops.filter((o) => o.responseCodes.some((c2) => /^[45]/.test(c2) || c2 === "default")).length) },
    { label: "Operations with an example", value: pct(ops.filter((o) => o.hasExamples).length) },
    { label: "Parameters with a description", value: (() => {
      const ps = ops.flatMap((o) => o.params);
      return ps.length ? Math.round(ps.filter((p) => p.description).length / ps.length * 100) : 100;
    })() }
  ];
  const score = Math.round(parts.reduce((a, p) => a + p.value, 0) / parts.length);
  return { score, parts };
}

// src/engine/server-checks.ts
function parseResponse(text) {
  const raw = (text ?? "").replace(/\r\n/g, "\n");
  const split = raw.indexOf("\n\n");
  const head = split >= 0 ? raw.slice(0, split) : raw;
  const body = split >= 0 ? raw.slice(split + 2) : "";
  const lines = head.split("\n").map((l) => l.trim()).filter(Boolean);
  let status;
  const headers = [];
  for (const line of lines) {
    const st = line.match(/^HTTP\/[\d.]+\s+(\d{3})/i);
    if (st) {
      status = Number(st[1]);
      continue;
    }
    const i = line.indexOf(":");
    if (i <= 0) continue;
    const name = line.slice(0, i).trim();
    if (!/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(name)) continue;
    headers.push({ name: name.toLowerCase(), value: line.slice(i + 1).trim() });
  }
  return { status, headers, body };
}
var get = (r, n) => r.headers.find((h) => h.name === n)?.value;
var all = (r, n) => r.headers.filter((h) => h.name === n).map((h) => h.value);
function f2(p) {
  return { area: "server", refs: [], ...p };
}
var STACK = [
  /\bat\s+[\w.$]+\([\w.]+\.java:\d+\)/,
  // Java
  /Traceback \(most recent call last\)/,
  // Python
  /\bat\s+.+\s\(.+\.(js|ts):\d+:\d+\)/,
  // Node
  /(Fatal error|Warning):.+ on line \d+/i,
  // PHP
  /System\.[\w.]+Exception/,
  // .NET
  /(SQLSTATE\[|You have an error in your SQL syntax|ORA-\d{5}|PG::|psycopg2\.|SequelizeDatabaseError)/i,
  // SQL
  /(\/var\/www\/|\/home\/\w+\/|C:\\\\(inetpub|Users)\\\\)/i
  // file paths
];
function checkResponse(text, opts = {}) {
  const r = parseResponse(text);
  const out = [];
  if (!r.headers.length) return out;
  const isHtml = opts.isHtml ?? /text\/html/i.test(get(r, "content-type") ?? "");
  const acao = get(r, "access-control-allow-origin");
  const acac = (get(r, "access-control-allow-credentials") ?? "").toLowerCase() === "true";
  if (acao) {
    if (acao === "*" && acac) {
      out.push(f2({
        rule: "CORS-WILDCARD-CREDS",
        severity: "high",
        title: "CORS allows any origin together with credentials",
        where: "Access-Control-Allow-Origin",
        evidence: `Access-Control-Allow-Origin: * and Access-Control-Allow-Credentials: true`,
        detail: 'Browsers refuse this pair, which usually means the server was set up to reflect origins to make it "work".',
        fix: "List the exact origins that may call the API with credentials; never combine * with credentials.",
        refs: [{ standard: API_TOP10.API8 }]
      }));
    } else if (acao === "*") {
      out.push(f2({
        rule: "CORS-WILDCARD",
        severity: opts.authenticated ? "medium" : "low",
        title: "CORS allows every origin",
        where: "Access-Control-Allow-Origin",
        evidence: "*",
        detail: "Any website can read this response from a visitor's browser. That is fine for public data and wrong for anything personal.",
        fix: "Keep * only on public, unauthenticated endpoints; allow-list origins everywhere else.",
        refs: [{ standard: API_TOP10.API8 }]
      }));
    }
    if (acao.toLowerCase() === "null") {
      out.push(f2({
        rule: "CORS-NULL",
        severity: "high",
        title: 'CORS allows the "null" origin',
        where: "Access-Control-Allow-Origin",
        evidence: "null",
        detail: "Sandboxed frames and local files send Origin: null, so allowing it lets pages you do not control read the response.",
        fix: "Remove null from the allowed origins.",
        refs: [{ standard: API_TOP10.API8 }]
      }));
    }
    if (opts.testOrigin && acao === opts.testOrigin.trim()) {
      out.push(f2({
        rule: "CORS-REFLECTED",
        severity: acac ? "critical" : "high",
        title: "CORS echoes back an origin it should not trust",
        where: "Access-Control-Allow-Origin",
        evidence: `${opts.testOrigin} was allowed${acac ? " with credentials" : ""}`,
        detail: "The server copies the request's Origin into the response, so every website is treated as trusted.",
        fix: "Compare the Origin against a fixed allow-list and send Vary: Origin; do not copy it.",
        refs: [{ standard: API_TOP10.API8 }]
      }));
    }
    if (acao !== "*" && !/origin/i.test(get(r, "vary") ?? "")) {
      out.push(f2({
        rule: "CORS-NO-VARY",
        severity: "low",
        title: "An origin-specific CORS answer has no Vary: Origin",
        where: "Vary",
        detail: "Caches may serve one origin's CORS answer to another.",
        fix: "Add Vary: Origin whenever Access-Control-Allow-Origin depends on the request.",
        refs: [{ standard: API_TOP10.API8 }]
      }));
    }
  }
  const methods = get(r, "access-control-allow-methods");
  if (methods && (methods.trim() === "*" || /\b(PUT|DELETE|PATCH)\b/i.test(methods) && /\bTRACE\b/i.test(methods))) {
    out.push(f2({
      rule: "CORS-METHODS",
      severity: "low",
      title: "CORS allows more methods than needed",
      where: "Access-Control-Allow-Methods",
      evidence: methods,
      detail: "Allowing every method across origins widens what another site can ask a browser to do.",
      fix: "Allow only the methods each route uses.",
      refs: [{ standard: API_TOP10.API8 }]
    }));
  }
  for (const c2 of all(r, "set-cookie")) {
    const name = c2.split("=")[0].trim();
    const lower = c2.toLowerCase();
    const missing = [];
    if (!/;\s*secure/.test(lower)) missing.push("Secure");
    if (!/;\s*httponly/.test(lower)) missing.push("HttpOnly");
    const ss = lower.match(/;\s*samesite=(\w+)/)?.[1];
    if (!ss) missing.push("SameSite");
    const session = /(sess|sid|auth|token|jwt|login|remember)/i.test(name);
    if (missing.length) {
      out.push(f2({
        rule: "COOKIE-FLAGS",
        severity: session ? missing.includes("Secure") || missing.includes("HttpOnly") ? "high" : "medium" : "low",
        title: `Cookie ${name} is missing ${missing.join(", ")}`,
        where: "Set-Cookie",
        evidence: c2.slice(0, 120),
        detail: `${missing.includes("Secure") ? "Without Secure it can travel over plain HTTP. " : ""}${missing.includes("HttpOnly") ? "Without HttpOnly any script on the page can read it. " : ""}${missing.includes("SameSite") ? "Without SameSite the browser sends it on cross-site requests. " : ""}`.trim(),
        fix: "Set Secure; HttpOnly; SameSite=Lax (or Strict) on session cookies, plus a Path and a short Max-Age.",
        refs: [{ standard: API_TOP10.API8 }]
      }));
    }
    if (ss === "none" && !/;\s*secure/.test(lower)) {
      out.push(f2({
        rule: "COOKIE-SAMESITE-NONE",
        severity: "medium",
        title: `Cookie ${name} uses SameSite=None without Secure`,
        where: "Set-Cookie",
        detail: "Browsers reject this combination, and it signals the cookie is meant to cross sites.",
        fix: "Use SameSite=Lax unless a cross-site flow needs None, and then always add Secure.",
        refs: [{ standard: API_TOP10.API8 }]
      }));
    }
  }
  const hsts = get(r, "strict-transport-security");
  if (!hsts) {
    out.push(f2({
      rule: "HDR-NO-HSTS",
      severity: "medium",
      title: "No Strict-Transport-Security header",
      where: "response headers",
      detail: "Without HSTS a browser may still try plain HTTP first, where the connection can be intercepted.",
      fix: "Send Strict-Transport-Security: max-age=31536000; includeSubDomains over HTTPS.",
      refs: [{ standard: API_TOP10.API8 }]
    }));
  } else {
    const age = Number(hsts.match(/max-age=(\d+)/i)?.[1] ?? 0);
    if (age < 15552e3) {
      out.push(f2({
        rule: "HDR-SHORT-HSTS",
        severity: "low",
        title: "HSTS max-age is under six months",
        where: "Strict-Transport-Security",
        evidence: hsts,
        detail: "A short max-age lets the protection lapse between visits.",
        fix: "Use max-age=31536000 (one year) once HTTPS is stable.",
        refs: [{ standard: API_TOP10.API8 }]
      }));
    }
  }
  if ((get(r, "x-content-type-options") ?? "").toLowerCase() !== "nosniff") {
    out.push(f2({
      rule: "HDR-NO-NOSNIFF",
      severity: "low",
      title: "No X-Content-Type-Options: nosniff",
      where: "response headers",
      detail: "Browsers may guess the content type and run a JSON or text response as script or HTML.",
      fix: "Send X-Content-Type-Options: nosniff on every response.",
      refs: [{ standard: API_TOP10.API8 }]
    }));
  }
  if (isHtml) {
    const csp = get(r, "content-security-policy");
    if (!csp) {
      out.push(f2({
        rule: "HDR-NO-CSP",
        severity: "medium",
        title: "An HTML page has no Content-Security-Policy",
        where: "response headers",
        detail: "Without a CSP, any injected script runs with the page's full rights.",
        fix: "Start with default-src 'self'; frame-ancestors 'none'; object-src 'none' and loosen only what the page needs.",
        refs: [{ standard: API_TOP10.API8 }]
      }));
    } else {
      const directives = new Map(csp.split(";").map((d) => d.trim().split(/\s+/)).filter((d) => d[0]).map((d) => [d[0].toLowerCase(), d.slice(1)]));
      const scripts = directives.get("script-src") ?? directives.get("default-src");
      const hashed = !!scripts?.some((s) => /^'(nonce|sha256|sha384|sha512)-/i.test(s));
      const weak = scripts?.filter((s) => s === "'unsafe-eval'" || s === "'unsafe-inline'" && !hashed) ?? [];
      if (weak.length) {
        out.push(f2({
          rule: "HDR-WEAK-CSP",
          severity: "low",
          title: "The CSP allows 'unsafe-inline' or 'unsafe-eval' scripts",
          where: "Content-Security-Policy",
          evidence: `${directives.has("script-src") ? "script-src" : "default-src"} ${weak.join(" ")}`,
          detail: "Inline and eval allowances undo most of the protection a CSP gives.",
          fix: "Move inline scripts to files or use nonces, then drop the unsafe keywords.",
          refs: [{ standard: API_TOP10.API8 }]
        }));
      }
    }
    if (!get(r, "x-frame-options") && !/frame-ancestors/i.test(csp ?? "")) {
      out.push(f2({
        rule: "HDR-NO-FRAME",
        severity: "low",
        title: "The page can be framed by any site",
        where: "response headers",
        detail: "Without frame-ancestors or X-Frame-Options another site can load the page invisibly and trick clicks on it.",
        fix: "Send Content-Security-Policy: frame-ancestors 'none' (or 'self').",
        refs: [{ standard: API_TOP10.API8 }]
      }));
    }
  }
  if (opts.authenticated) {
    const cc = (get(r, "cache-control") ?? "").toLowerCase();
    if (!/no-store|private/.test(cc)) {
      out.push(f2({
        rule: "HDR-CACHEABLE",
        severity: "medium",
        title: "A signed-in response may be cached",
        where: "Cache-Control",
        evidence: cc || "(none)",
        detail: "Shared caches and proxies can keep personal data and hand it to the next person.",
        fix: "Send Cache-Control: no-store on responses that contain personal or account data.",
        refs: [{ standard: API_TOP10.API8 }]
      }));
    }
  }
  for (const n of ["server", "x-powered-by", "x-aspnet-version", "x-aspnetmvc-version", "x-generator"]) {
    const v = get(r, n);
    if (v && (/\d/.test(v) || n !== "server")) {
      out.push(f2({
        rule: "HDR-VERSION-LEAK",
        severity: "low",
        title: `The ${n} header names the software${/\d/.test(v) ? " and its version" : ""}`,
        where: n,
        evidence: `${n}: ${v}`,
        detail: "Version banners tell anyone which known vulnerabilities to look up.",
        fix: `Remove ${n} or reduce it to a generic value at the proxy.`,
        refs: [{ standard: API_TOP10.API8 }]
      }));
    }
  }
  if (r.body) {
    const head = r.body.slice(0, 2e4);
    const hit = STACK.find((re) => re.test(head));
    if (hit) {
      out.push(f2({
        rule: "ERR-STACK",
        severity: "high",
        title: "The response body shows a stack trace, SQL error or file path",
        where: "response body",
        evidence: (head.match(hit)?.[0] ?? "").slice(0, 120),
        detail: "Internal errors reveal the language, libraries, file layout and sometimes the query, which narrows down what to try next.",
        fix: "Catch errors at one handler, return a short message with a correlation id, and log the detail on the server only.",
        refs: [{ standard: API_TOP10.API8 }]
      }));
    }
  }
  const rl = r.headers.some((h) => /^(x-)?ratelimit|^retry-after$|^x-rate-limit/i.test(h.name));
  if (!rl) {
    out.push(f2({
      rule: "HDR-NO-RATELIMIT",
      severity: "info",
      title: "No rate-limit headers in the response",
      where: "response headers",
      detail: "The response does not show a limit. One may exist; if it does, telling clients helps them back off.",
      fix: "Send RateLimit-Limit, RateLimit-Remaining and RateLimit-Reset (or the X- versions), and 429 with Retry-After.",
      refs: [{ standard: API_TOP10.API4 }]
    }));
  }
  if (r.status === 401 || r.status === 403) {
    out.push(f2({
      rule: "SL-STATUS-DISCLOSURE",
      severity: "info",
      title: `Status ${r.status} tells the caller the resource exists`,
      where: `HTTP ${r.status}`,
      detail: "For objects the caller may not see, 404 reveals less than 401 or 403.",
      fix: "Pick one rule for your API standard and apply it everywhere.",
      refs: []
    }));
  }
  return out;
}

// src/engine/jwt.ts
function b64urlDecode(part) {
  const pad = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
  const bin = typeof atob === "function" ? atob(pad) : Buffer.from(pad, "base64").toString("binary");
  const bytes = Uint8Array.from(bin, (c2) => c2.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
function decodeJwt(token) {
  const t = (token ?? "").trim().replace(/^Bearer\s+/i, "");
  const parts = t.split(".");
  if (parts.length !== 3 && parts.length !== 2) throw new Error("A JWT has three parts separated by dots.");
  let header;
  let payload;
  try {
    header = JSON.parse(b64urlDecode(parts[0]));
  } catch {
    throw new Error("The first part does not decode to a JSON header.");
  }
  try {
    payload = JSON.parse(b64urlDecode(parts[1]));
  } catch {
    throw new Error("The second part does not decode to JSON claims.");
  }
  if (!header || typeof header !== "object" || !payload || typeof payload !== "object") throw new Error("The token parts are not JSON objects.");
  return { header, payload, signaturePresent: parts.length === 3 && parts[2].length > 0 };
}
var SENSITIVE_CLAIM = /^(password|pwd|pass|secret|ssn|social_security|card|card_number|pan|cvv|dob|date_of_birth|address|phone|national_id|tax_id|salary|diagnosis)$/i;
function checkJwt(token, nowSeconds = Math.floor(Date.now() / 1e3)) {
  const decoded = decodeJwt(token);
  const { header, payload } = decoded;
  const out = [];
  const ref = [{ standard: API_TOP10.API2 }];
  const push = (p) => out.push({ area: "token", refs: ref, ...p });
  const alg = String(header.alg ?? "");
  if (!alg || alg.toLowerCase() === "none" || !decoded.signaturePresent) {
    push({
      rule: "JWT-NO-SIGNATURE",
      severity: "critical",
      title: "The token is not signed",
      where: "header.alg",
      evidence: `alg: ${alg || "(missing)"}`,
      detail: "An unsigned token can be edited by anyone who holds it. A server that accepts it trusts whatever the claims say.",
      fix: 'Reject alg "none" and unsigned tokens on the server, and pin the algorithm you expect instead of reading it from the token.'
    });
  } else if (/^HS(256|384|512)$/.test(alg)) {
    push({
      rule: "JWT-SHARED-SECRET",
      severity: "low",
      title: `Signed with a shared secret (${alg})`,
      where: "header.alg",
      evidence: alg,
      detail: "Every service that verifies the token also holds the key that can create one, and a short secret can be guessed offline.",
      fix: "Use a random secret of at least 32 bytes, or move to RS256 or ES256 so verifiers only hold a public key."
    });
  }
  for (const k of ["jku", "x5u", "jwk"]) {
    if (k in header) {
      push({
        rule: "JWT-KEY-IN-HEADER",
        severity: "high",
        title: `The header carries "${k}", which points to its own key`,
        where: `header.${k}`,
        evidence: String(header[k]).slice(0, 80),
        detail: "If the server follows it, the token chooses the key it is checked with.",
        fix: `Ignore ${k} and verify only with keys from your own configuration or an allow-listed JWKS URL.`
      });
    }
  }
  if (typeof header.kid === "string" && /(\.\.|\/|\\|'|;|\s)/.test(header.kid)) {
    push({
      rule: "JWT-ODD-KID",
      severity: "medium",
      title: "The key id contains path or query characters",
      where: "header.kid",
      evidence: header.kid.slice(0, 80),
      detail: "A kid that is used to look up a file or row should be a plain identifier.",
      fix: "Accept only kid values from a fixed list of your own keys."
    });
  }
  const exp = typeof payload.exp === "number" ? payload.exp : void 0;
  const iat = typeof payload.iat === "number" ? payload.iat : void 0;
  if (exp === void 0) {
    push({
      rule: "JWT-NO-EXP",
      severity: "high",
      title: "The token never expires",
      where: "payload.exp",
      detail: "A stolen token without exp works until the signing key changes.",
      fix: "Issue access tokens with exp 5 to 60 minutes ahead and use refresh tokens for longer sessions."
    });
  } else {
    const life = iat !== void 0 ? exp - iat : void 0;
    if (life !== void 0 && Number.isFinite(life) && life > 24 * 3600) {
      push({
        rule: "JWT-LONG-LIFE",
        severity: "medium",
        title: `The token lives for ${Math.round(life / 3600)} hours`,
        where: "payload.exp",
        detail: "Long-lived access tokens give a stolen token a long useful life.",
        fix: "Keep access tokens under an hour; refresh them with a revocable refresh token."
      });
    }
    if (exp < nowSeconds) {
      const when = new Date(exp * 1e3);
      push({
        rule: "JWT-EXPIRED",
        severity: "info",
        title: "The token has expired",
        where: "payload.exp",
        evidence: Number.isNaN(when.getTime()) ? `exp ${exp}` : when.toISOString(),
        detail: "Check that your API rejects it: send it once and expect 401.",
        fix: "Nothing to change in the token; make sure the server checks exp."
      });
    }
  }
  if (!("aud" in payload)) {
    push({
      rule: "JWT-NO-AUD",
      severity: "medium",
      title: "No audience claim",
      where: "payload.aud",
      detail: "Without aud, a token issued for one API can be replayed against another that trusts the same issuer.",
      fix: "Set aud to the API it is meant for and check it on every request."
    });
  }
  if (!("iss" in payload)) {
    push({
      rule: "JWT-NO-ISS",
      severity: "low",
      title: "No issuer claim",
      where: "payload.iss",
      detail: "Verifiers cannot tell which authorization server issued the token.",
      fix: "Set iss and check it against the expected issuer."
    });
  }
  const sensitive = Object.keys(payload).filter((k) => SENSITIVE_CLAIM.test(k));
  if (sensitive.length) {
    push({
      rule: "JWT-SENSITIVE-CLAIMS",
      severity: "high",
      title: "Personal or secret data is stored in the claims",
      where: "payload",
      evidence: sensitive.join(", "),
      detail: "JWT claims are only encoded, not encrypted: anyone holding the token can read them.",
      fix: "Keep only identifiers and scopes in the token; look personal data up on the server.",
      refs: [{ standard: API_TOP10.API3 }]
    });
  }
  const scope = String(payload.scope ?? payload.scp ?? "");
  if (/(^|\s)(\*|admin|all|full_access|root)(\s|$)/i.test(scope)) {
    push({
      rule: "JWT-BROAD-SCOPE",
      severity: "medium",
      title: "The token carries an all-powerful scope",
      where: "payload.scope",
      evidence: scope.slice(0, 80),
      detail: "One leaked token with a broad scope opens every endpoint.",
      fix: "Issue the narrowest scopes each client needs.",
      refs: [{ standard: API_TOP10.API5 }]
    });
  }
  return { decoded, findings: out };
}

// src/engine/diff.ts
var SENSITIVE = /^(password|passwd|pass_?hash|password_?hash|secret|client_?secret|api_?key|access_?token|refresh_?token|token|otp|pin|cvv|cvc|card_?number|pan|ssn|tax_?id|national_?id|private_?key)$/i;
function isPublic2(op) {
  if (op.security === null) return true;
  return op.security.length === 0 || op.security.some((r) => Object.keys(r).length === 0);
}
var scopes = (op) => [...new Set((op.security ?? []).flatMap((r) => Object.values(r).flat()))].sort();
function parseVersion(v) {
  const m = String(v).match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : null;
}
function declaredBump(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return "unknown";
  if (y[0] > x[0]) return "major";
  if (y[0] === x[0] && y[1] > x[1]) return "minor";
  if (y[0] === x[0] && y[1] === x[1] && y[2] > x[2]) return "patch";
  if (y[0] === x[0] && y[1] === x[1] && y[2] === x[2]) return "none";
  return "unknown";
}
var RANK = { none: 0, patch: 1, minor: 2, major: 3 };
function fingerprint(api) {
  const seen = /* @__PURE__ */ new WeakSet();
  try {
    return JSON.stringify(api.operations, (_k, v) => {
      if (v && typeof v === "object") {
        if (seen.has(v)) return "[cycle]";
        seen.add(v);
      }
      return v;
    });
  } catch {
    return String(api.operations.length);
  }
}
function diffApis(before, after) {
  const a = new Map(before.operations.map((o) => [o.key, o]));
  const b = new Map(after.operations.map((o) => [o.key, o]));
  const added = [...b.keys()].filter((k) => !a.has(k));
  const removed = [...a.keys()].filter((k) => !b.has(k));
  const changed = [];
  const findings = [];
  let need = "none";
  const raise = (x) => {
    if (RANK[x] > RANK[need]) need = x;
  };
  const ref = (s) => s ? [{ standard: s }] : [];
  if (removed.length) {
    raise("major");
    for (const k of removed) {
      findings.push({
        rule: "REL-REMOVED",
        area: "release",
        severity: "medium",
        title: "An operation was removed",
        where: k,
        detail: "Clients that still call it will break. This is a breaking change.",
        fix: "Deprecate first with a removal date, then remove in a major version.",
        refs: ref(API_TOP10.API9)
      });
    }
  }
  if (added.length) raise("minor");
  for (const k of added) {
    const op = b.get(k);
    if (isPublic2(op)) {
      findings.push({
        rule: "REL-NEW-PUBLIC",
        area: "release",
        severity: op.method === "get" ? "medium" : "high",
        title: "A new operation needs no authentication",
        where: k,
        detail: "This release adds an endpoint anyone can call.",
        fix: "Apply the security scheme, or record why it is public.",
        refs: ref(API_TOP10.API2)
      });
    }
  }
  for (const [k, nb] of b) {
    const na = a.get(k);
    if (!na) continue;
    const notes = [];
    if (!isPublic2(na) && isPublic2(nb)) {
      notes.push("lost its authentication");
      findings.push({
        rule: "REL-AUTH-REMOVED",
        area: "release",
        severity: "critical",
        title: "An operation lost its authentication",
        where: k,
        detail: "It required a token before this release and is now public.",
        fix: "Restore the security requirement unless this was decided and reviewed.",
        refs: ref(API_TOP10.API2)
      });
    } else {
      const sa = scopes(na);
      const sb = scopes(nb);
      const dropped = sa.filter((s) => !sb.includes(s));
      if (sa.length && dropped.length && sb.length < sa.length) {
        notes.push("needs fewer scopes");
        findings.push({
          rule: "REL-SCOPE-REDUCED",
          area: "release",
          severity: "high",
          title: "An operation now needs fewer scopes",
          where: k,
          evidence: `dropped ${dropped.join(", ")}`,
          detail: "Clients with less permission can now call it.",
          fix: "Confirm the change was intended and reviewed.",
          refs: ref(API_TOP10.API5)
        });
      }
    }
    const before2 = new Set(na.responseFields.map((f3) => f3.path));
    const newSensitive = nb.responseFields.filter((f3) => !before2.has(f3.path) && SENSITIVE.test(f3.name));
    if (newSensitive.length) {
      notes.push("returns new sensitive fields");
      findings.push({
        rule: "REL-NEW-SENSITIVE",
        area: "release",
        severity: "high",
        title: "The response now includes sensitive fields",
        where: k,
        evidence: newSensitive.map((f3) => f3.path).join(", "),
        detail: "This release starts returning data that should stay on the server.",
        fix: "Remove the fields from the response model before release.",
        refs: ref(API_TOP10.API3)
      });
    }
    if (na.responseCodes.includes("429") && !nb.responseCodes.includes("429")) {
      notes.push("no longer documents a rate limit");
      findings.push({
        rule: "REL-LIMIT-REMOVED",
        area: "release",
        severity: "medium",
        title: "An operation no longer documents its rate limit",
        where: k,
        detail: "The previous release answered 429 here. If the limit went with the documentation, the endpoint can now be called without bound.",
        fix: "Confirm the limit still runs at the gateway and restore the 429 response in the spec.",
        refs: ref(API_TOP10.API4)
      });
    }
    if (na.requestAdditionalProps === false && nb.requestAdditionalProps === true) {
      notes.push("accepts unknown properties again");
      findings.push({
        rule: "REL-BODY-OPENED",
        area: "release",
        severity: "low",
        title: "The request body accepts unknown properties again",
        where: k,
        detail: "additionalProperties: false was dropped, so fields the server never meant to bind now pass validation.",
        fix: "Put additionalProperties: false back on the request schema.",
        refs: ref(API_TOP10.API3)
      });
    }
    const reqA = new Set(na.params.filter((p) => p.required).map((p) => `${p.in}:${p.name}`));
    const newRequired = nb.params.filter((p) => p.required && !reqA.has(`${p.in}:${p.name}`) && p.in !== "path");
    if (newRequired.length) {
      raise("major");
      notes.push("has new required parameters");
      findings.push({
        rule: "REL-NEW-REQUIRED",
        area: "release",
        severity: "low",
        title: "A new required parameter breaks existing clients",
        where: k,
        evidence: newRequired.map((p) => p.name).join(", "),
        detail: "Existing clients do not send it and will start failing.",
        fix: "Make it optional with a default, or ship it in a major version.",
        refs: ref(API_TOP10.API9)
      });
    }
    const respB = new Set(nb.responseFields.map((f3) => f3.path));
    const goneFields = na.responseFields.filter((f3) => !respB.has(f3.path) && !SENSITIVE.test(f3.name));
    if (goneFields.length) {
      raise("major");
      notes.push("dropped response fields");
      findings.push({
        rule: "REL-FIELD-REMOVED",
        area: "release",
        severity: "low",
        title: "Response fields were removed",
        where: k,
        evidence: goneFields.slice(0, 4).map((f3) => f3.path).join(", "),
        detail: "Clients that read these fields will break.",
        fix: "Keep them (deprecated) until the next major version.",
        refs: ref(API_TOP10.API9)
      });
    }
    const addedOptional = nb.params.filter((p) => !p.required && !na.params.some((q) => q.name === p.name && q.in === p.in));
    if (addedOptional.length || nb.responseFields.length > na.responseFields.length) {
      raise("minor");
      if (!notes.length) notes.push("gained optional parameters or fields");
    }
    if (!na.deprecated && nb.deprecated) notes.push("is now deprecated");
    if (JSON.stringify(na.responseCodes.sort()) !== JSON.stringify(nb.responseCodes.sort()) && !notes.length) {
      raise("patch");
      notes.push("changed its documented responses");
    }
    if (notes.length) changed.push(`${k}: ${notes.join(", ")}`);
  }
  if (need === "none" && fingerprint(before) !== fingerprint(after)) raise("patch");
  const db = declaredBump(before.version, after.version);
  const bumpOk = db !== "unknown" && RANK[db] >= RANK[need] && (need === "none" || db !== "none");
  if (!bumpOk && need !== "none") {
    findings.push({
      rule: "REL-SEMVER",
      area: "release",
      severity: need === "major" ? "medium" : "low",
      title: `This release needs a ${need} version bump`,
      where: `info.version ${before.version} \u2192 ${after.version}`,
      detail: `The changes call for a ${need} bump, but the version ${db === "unknown" ? "could not be read as MAJOR.MINOR.PATCH" : db === "none" ? "did not change" : `only moved by a ${db}`}.`,
      fix: need === "major" ? "Raise the major number, or keep the old behaviour alongside the new until the next major release." : `Raise the ${need} number.`,
      refs: ref(API_TOP10.API9)
    });
  }
  return { added, removed, changed, findings, requiredBump: need, declared: { from: before.version, to: after.version, bump: db }, bumpOk };
}

// src/engine/agent.ts
var make = (p) => ({ area: "agent", refs: [], ...p });
var HIDDEN = /[­᠎​-‏‪-‮⁠-⁤⁦-⁩﻿]|\uDB40[\uDC00-\uDC7F]/g;
function findHiddenChars(text) {
  const hits = text.match(HIDDEN) ?? [];
  const codes = [...new Set(hits.map((h) => "U+" + (h.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")))];
  return { count: hits.length, codes };
}
function revealHidden(text) {
  return text.replace(HIDDEN, (h) => `[U+${(h.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")}]`);
}
var DIRECTIVES = [
  { id: "override", label: "tells the model to set aside its other instructions", re: /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(previous|prior|above|earlier|other|all|system)\b[^.\n]{0,24}\b(instructions?|rules?|prompts?|guidelines?)\b/i },
  { id: "conceal", label: "asks the model to keep something from the user", re: /\b(do not|don't|never|without)\b[^.\n]{0,30}\b(tell|telling|mention|mentioning|inform|informing|reveal|revealing|show|showing|notify|notifying)\b[^.\n]{0,20}\b(the )?users?\b/i },
  { id: "tags", label: "contains markup aimed at the model", re: /<\/?\s*(important|system|instructions?|secret|hidden|admin|override)\s*>/i },
  { id: "cross-tool", label: "gives orders about other tools", re: /\b(before|after|instead of|whenever you)\b[^.\n]{0,40}\b(using|calling|call|use|invoking)\b[^.\n]{0,20}\b(any|other|another|every|the)\b[^.\n]{0,12}\btools?\b/i },
  { id: "role", label: "tries to redefine the model's role", re: /\b(you are now|from now on,? you|act as (an? )?(admin|administrator|developer|system)|system prompt)\b/i },
  { id: "secrets", label: "refers to credential files or keys", re: /(~\/\.ssh|id_rsa|\.env\b|\.aws\/credentials|mcp\.json|private key|api[_ ]?keys? (of|from) the user)/i },
  { id: "forward", label: "asks for conversation or credentials to be passed along", re: /\b(send|forward|upload|post|include|append|copy)\b[^.\n]{0,40}\b(conversation|chat history|message history|previous messages|credentials|passwords?|secrets?|tokens?)\b/i }
];
function directiveHits(text) {
  const out = [];
  for (const d of DIRECTIVES) {
    const m = text.match(d.re);
    if (m && m.index !== void 0) {
      const start = Math.max(0, m.index - 20);
      const quote = text.slice(start, m.index + m[0].length + 20).replace(/\s+/g, " ").trim();
      out.push({ label: d.label, quote: (start > 0 ? "\u2026" : "") + quote + (m.index + m[0].length + 20 < text.length ? "\u2026" : "") });
    }
  }
  return out;
}
function words(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}
var WRITE_VERB = /^(delete|remove|destroy|drop|send|email|post|publish|refund|transfer|pay|charge|withdraw|update|edit|modify|patch|create|add|write|insert|upsert|set|execute|exec|run|deploy|approve|cancel|purge|reset|grant|revoke|invite|book|order|submit|move|rename|upload|merge|close|archive)$/;
var HIGH_IMPACT = /^(delete|remove|destroy|drop|refund|transfer|pay|charge|withdraw|purge|grant|revoke|execute|exec|deploy|send|email|publish|approve|reset)$/;
var CONFUSABLE = {
  "0": "o",
  "1": "l",
  "3": "e",
  "5": "s",
  "7": "t",
  "|": "l",
  "\u0430": "a",
  "\u0435": "e",
  "\u043E": "o",
  "\u0440": "p",
  "\u0441": "c",
  "\u0445": "x",
  "\u0443": "y",
  "\u0456": "i",
  "\u0458": "j",
  "\u04BB": "h",
  "\u0501": "d",
  "\u051B": "q",
  "\u051D": "w"
};
function skeleton(name) {
  return [...name.normalize("NFKC").toLowerCase()].map((c2) => CONFUSABLE[c2] ?? c2).join("").replace(/[^a-z]/g, "");
}
function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}
var FREEFORM = /^(command|cmd|shell|shell_?command|script|code|source_?code|sql|raw_?sql|sql_?query|query_?string|expression|expr|eval|javascript|js|python|bash|powershell)$/i;
var URL_PARAM = /^(url|uri|link|href|endpoint|webhook(_?url)?|callback(_?url)?|redirect(_?url|_?uri)?|target(_?url)?|fetch_?url|image_?url|feed(_?url)?|source_?url|host)$/i;
var PATH_PARAM = /^(path|file|filename|file_?name|file_?path|filepath|dir|directory|folder|location)$/i;
var ID_PARAM = /^(user_?id|account_?id|customer_?id|tenant_?id|org(anization)?_?id|owner_?id|member_?id|patient_?id|employee_?id|as_?user|on_?behalf_?of)$/i;
var SECRET_PARAM = /(password|passwd|secret|api_?key|apikey|access_?token|auth_?token|bearer|credential|private_?key)/i;
function checkTools(tools) {
  const out = [];
  for (const t of tools) {
    const where = `tool ${t.name}`;
    const w = words(t.name);
    const verb = w.find((x) => WRITE_VERB.test(x));
    const highImpact = w.some((x) => HIGH_IMPACT.test(x)) || t.annotations.destructiveHint === true;
    const declaredReadOnly = t.annotations.readOnlyHint === true;
    const hidden = findHiddenChars(`${t.name}
${t.scanText}`);
    if (hidden.count) {
      out.push(make({
        rule: "TOOL-HIDDEN-CHARS",
        severity: "critical",
        title: "The definition contains invisible characters",
        where,
        evidence: `${hidden.count} hidden code point${hidden.count > 1 ? "s" : ""}: ${hidden.codes.slice(0, 6).join(", ")}`,
        detail: "Zero-width, direction-override or tag characters do not show in a review tool but the model still reads them. A definition that carries them cannot be reviewed by eye.",
        fix: "Remove every invisible code point from names, descriptions and schemas, and fail CI when a tool definition contains one.",
        refs: [{ standard: LLM_RISK.injection }]
      }));
    }
    const hits = directiveHits(t.scanText);
    if (hits.length) {
      out.push(make({
        rule: "TOOL-INSTRUCTION-TEXT",
        severity: "high",
        title: "The description talks to the model, not about the tool",
        where,
        evidence: hits[0].quote.slice(0, 160),
        detail: `The text ${hits.map((h) => h.label).join("; ")}. A tool description should only say what the tool does and what its inputs mean; anything else is an instruction the model may follow.`,
        fix: "Rewrite the description as a plain statement of what the tool does. Review every change to tool text before it ships, as you would review code.",
        refs: [{ standard: LLM_RISK.injection }, { standard: LLM_RISK.supply }]
      }));
    }
    if (highImpact && !declaredReadOnly) {
      out.push(make({
        rule: "TOOL-NEEDS-APPROVAL",
        severity: /refund|transfer|pay|charge|withdraw|delete|destroy|drop|purge|grant|revoke|execute|exec|deploy/.test(w.join(" ")) ? "high" : "medium",
        title: "A tool moves money, deletes data or changes access",
        where,
        evidence: verb ?? (t.annotations.destructiveHint ? "destructiveHint: true" : void 0),
        detail: "A model can call this tool on the strength of text it has read in a document, an email or a web page. Without a person in the loop, one misread instruction becomes a real action.",
        fix: "Have the server hold the action as pending and execute it only after the signed-in user confirms. Cap how often it can run per user per day.",
        refs: [{ standard: LLM_RISK.agency }]
      }));
    }
    if (t.source === "mcp" && verb && t.annotations.readOnlyHint === void 0 && t.annotations.destructiveHint === void 0) {
      out.push(make({
        rule: "TOOL-NO-ANNOTATIONS",
        severity: "low",
        title: "A tool that changes data declares no hints",
        where,
        evidence: verb,
        detail: "MCP clients use readOnlyHint and destructiveHint to decide when to ask the user first. Without them the client has to guess.",
        fix: "Set readOnlyHint: false and destructiveHint: true (or false) on every tool that writes, and readOnlyHint: true on the ones that only read.",
        refs: [{ standard: LLM_RISK.agency }]
      }));
    }
    for (const p of t.params) {
      if (FREEFORM.test(p.name)) {
        out.push(make({
          rule: "TOOL-FREEFORM-EXEC",
          severity: "critical",
          title: "A parameter takes a command, script or query",
          where: `${where} \xB7 ${p.name}`,
          evidence: p.name,
          detail: "Whatever the model writes into this parameter runs as code or as a query. The tool can do anything the server can.",
          fix: "Replace it with narrow tools that each take typed values (an order id, a date range) and build the query on the server.",
          refs: [{ standard: LLM_RISK.agency }]
        }));
      }
      if (URL_PARAM.test(p.name) || /\b(url|uri)\b/i.test(p.description ?? "") && p.type === "string" && /fetch|download|request|load/i.test(`${t.description} ${p.description}`)) {
        out.push(make({
          rule: "TOOL-URL-PARAM",
          severity: "medium",
          title: "The model chooses a URL the server fetches",
          where: `${where} \xB7 ${p.name}`,
          evidence: p.name,
          detail: "If the server fetches it, the model (or text it read) can point the server at internal addresses or send data to an outside host.",
          fix: "Allow-list the hosts this tool may reach, block private and link-local ranges after DNS resolution, and never return the raw response.",
          refs: [{ standard: API_TOP10.API7 }]
        }));
      }
      if (PATH_PARAM.test(p.name)) {
        out.push(make({
          rule: "TOOL-PATH-PARAM",
          severity: "medium",
          title: "The model chooses a file path",
          where: `${where} \xB7 ${p.name}`,
          evidence: p.name,
          detail: "A path such as ../../.env reaches files outside the folder the tool was meant for.",
          fix: "Resolve the path against one fixed base folder and reject anything that resolves outside it; prefer file ids over paths.",
          refs: [{ standard: API_TOP10.API8 }]
        }));
      }
      if (ID_PARAM.test(p.name)) {
        out.push(make({
          rule: "TOOL-ID-PARAM",
          severity: "high",
          title: "The model chooses whose data to act on",
          where: `${where} \xB7 ${p.name}`,
          evidence: p.name,
          detail: "The tool takes the user or account as an argument, so a confused or misled model can act on someone else's records.",
          fix: "Take the identity from the signed-in session on the server, drop the parameter, and check ownership of every object.",
          refs: [{ standard: API_TOP10.API1 }]
        }));
      }
      if (SECRET_PARAM.test(p.name)) {
        out.push(make({
          rule: "TOOL-SECRET-PARAM",
          severity: "high",
          title: "A credential passes through the model",
          where: `${where} \xB7 ${p.name}`,
          evidence: p.name,
          detail: "The model has to hold this secret in its context to fill the parameter, where it can be logged, echoed in an answer or sent to another tool.",
          fix: "Inject credentials on the server side of the tool, from a secret store, and remove the parameter.",
          refs: [{ standard: LLM_RISK.disclosure }]
        }));
      }
    }
    if (t.schemaOpen) {
      out.push(make({
        rule: "TOOL-SCHEMA-OPEN",
        severity: "low",
        title: "The input schema accepts extra properties",
        where,
        detail: "additionalProperties is not false, so the model can pass fields the server never meant to receive.",
        fix: "Set additionalProperties: false, list required fields, and validate arguments on the server before acting.",
        refs: [{ standard: API_TOP10.API3 }]
      }));
    }
    const undescribed = t.params.filter((p) => !p.description).length;
    if (t.description.trim().length < 20 || t.params.length > 1 && undescribed / t.params.length > 0.5) {
      out.push(make({
        rule: "TOOL-UNDESCRIBED",
        severity: "low",
        title: "The tool or its inputs are barely described",
        where,
        evidence: t.description.trim() ? `"${t.description.trim().slice(0, 60)}"` : "(no description)",
        detail: "A model picks tools and fills arguments from these words. Thin descriptions lead to wrong calls.",
        fix: "Say in one or two sentences what the tool does, what it changes and when not to use it; describe every parameter.",
        refs: []
      }));
    }
    if (t.description.length > 1500) {
      out.push(make({
        rule: "TOOL-LONG-DESC",
        severity: "low",
        title: "The description is too long to review",
        where,
        evidence: `${t.description.length} characters`,
        detail: "Very long descriptions cost context on every call and are where unwanted instructions are easiest to miss.",
        fix: "Keep descriptions under 500 characters and move usage notes to your own documentation.",
        refs: [{ standard: LLM_RISK.injection }]
      }));
    }
  }
  const seen = /* @__PURE__ */ new Map();
  const flagged = /* @__PURE__ */ new Set();
  for (const t of tools) {
    if (/[^\x20-\x7E]/.test(t.name) && !flagged.has(t.name)) {
      flagged.add(t.name);
      out.push(make({
        rule: "TOOL-LOOKALIKE",
        severity: "high",
        title: "A tool name uses non-ASCII letters",
        where: `tool ${revealHidden(t.name)}`,
        detail: "Letters from another alphabet can make one tool look like another, so a reviewer approves the wrong one.",
        fix: "Restrict tool names to [a-z0-9_-] and reject anything else when servers register tools.",
        refs: [{ standard: LLM_RISK.supply }]
      }));
    }
  }
  for (let i = 0; i < tools.length; i++) {
    for (let j = i + 1; j < tools.length; j++) {
      const a = tools[i].name;
      const b = tools[j].name;
      const sa = skeleton(a);
      const sb = skeleton(b);
      const same = a === b;
      const close = !same && sa.length >= 5 && (sa === sb || editDistance(sa, sb) === 1);
      if ((same || close) && !seen.has(`${a}|${b}`)) {
        seen.set(`${a}|${b}`, "1");
        out.push(make({
          rule: "TOOL-LOOKALIKE",
          severity: same ? "high" : "medium",
          title: same ? "Two tools share one name" : "Two tool names are nearly the same",
          where: `tools ${revealHidden(a)} and ${revealHidden(b)}`,
          evidence: same ? a : `${a} / ${b}`,
          detail: same ? "When two servers register the same name, which one runs depends on load order. One can quietly shadow the other." : "Names this close are easy to confuse for a reviewer and for the model, and are a common sign of a copied or shadowing tool.",
          fix: "Prefix tool names with their server (billing_issue_refund) and keep an allow-list of the exact tools each agent may call.",
          refs: [{ standard: LLM_RISK.supply }]
        }));
      }
    }
  }
  return out;
}
var AI_OP = /(chat|completion|prompt|generat|llm|assistant|\bask\b|\/ask|agent|embedding|summar|\brag\b|copilot|\/ai(\/|$)|\bai\b|gpt|inference|answer)/i;
var PROMPT_FIELD = /^(prompt|input|inputs|message|messages|content|query|question|text|user_?input|utterance)$/i;
var SYSTEM_FIELD = /^(system|system_?prompt|system_?message|instructions|preamble|persona|context_?prompt)$/i;
var MODEL_FIELD = /^(model|model_?id|engine|deployment)$/i;
var TOKENS_FIELD = /^(max_?tokens|max_?output_?tokens|max_?new_?tokens|max_?completion_?tokens|maxTokens|n|num_?results)$/i;
var PII_FIELD = /^(email|phone|phone_?number|mobile|ssn|social_?security(_?number)?|dob|date_?of_?birth|birth_?date|address|street|card_?number|pan|iban|passport(_?number)?|national_?id|tax_?id|patient(_?name)?|diagnosis|medical_?record|salary)$/i;
var RENDER_FIELD = /^(html|rendered|rendered_?html|answer_?html|markdown|body_?html|output_?html)$/i;
function isAiOperation(op) {
  return AI_OP.test(`${op.path} ${op.operationId ?? ""} ${op.summary ?? ""} ${op.tags.join(" ")}`);
}
function documentsLimit2(op) {
  const ext = Object.keys(op.extensions).some((k) => /rate|throttl|limit|quota|budget/.test(k));
  return op.responseCodes.includes("429") || ext || /rate.?limit|throttl|per (minute|hour|day)|quota|budget/i.test(`${op.summary ?? ""} ${op.description ?? ""}`);
}
function checkAiSurface(api) {
  const out = [];
  const texts = [{ where: "info.description", text: api.description ?? "" }];
  for (const op of api.operations) {
    texts.push({ where: op.key, text: [op.summary, op.description, ...op.params.map((p) => p.description), ...op.requestFields.map((f3) => f3.description)].filter(Boolean).join("\n") });
  }
  for (const t of texts) {
    const h = findHiddenChars(t.text);
    if (h.count) {
      out.push(make({
        rule: "SPEC-HIDDEN-TEXT",
        severity: "high",
        title: "The spec text contains invisible characters",
        where: t.where,
        evidence: `${h.count} hidden code point${h.count > 1 ? "s" : ""}: ${h.codes.slice(0, 6).join(", ")}`,
        detail: "Agents and tool generators turn these descriptions into tool text. Invisible characters reach the model without anyone seeing them.",
        fix: "Strip invisible code points from the spec and add a CI check that fails on them.",
        refs: [{ standard: LLM_RISK.injection }]
      }));
    }
    const d = directiveHits(t.text);
    if (d.length) {
      out.push(make({
        rule: "SPEC-INSTRUCTION-TEXT",
        severity: "medium",
        title: "A description addresses an AI model",
        where: t.where,
        evidence: d[0].quote.slice(0, 160),
        detail: `The text ${d.map((x) => x.label).join("; ")}. When this spec is turned into agent tools, the sentence becomes an instruction.`,
        fix: "Keep descriptions factual: what the operation does, who may call it and what it changes.",
        refs: [{ standard: LLM_RISK.injection }]
      }));
    }
  }
  for (const op of api.operations.filter(isAiOperation)) {
    const where = op.key;
    const req = op.requestFields;
    const prompts = req.filter((f3) => PROMPT_FIELD.test(f3.name) && (f3.type === "string" || f3.type === void 0) && f3.maxLength === void 0);
    if (prompts.length) {
      out.push(make({
        rule: "LLM-INPUT-LIMIT",
        severity: "medium",
        title: "The prompt has no length limit",
        where,
        evidence: prompts.map((f3) => f3.path).slice(0, 3).join(", "),
        detail: "Unbounded input lets one request fill the model's context, run up its cost and bury your own instructions under someone else's text.",
        fix: "Set maxLength on prompt fields, enforce it on the server and count tokens before calling the model.",
        refs: [{ standard: API_TOP10.API4 }]
      }));
    }
    const sys = req.filter((f3) => SYSTEM_FIELD.test(f3.name));
    const roleField = req.find((f3) => /(^|\.)(messages\[\]\.)?role$/.test(f3.path) || f3.name === "role");
    const roleOpen = roleField && (!roleField.enumValues || roleField.enumValues.includes("system"));
    if (sys.length || roleOpen) {
      out.push(make({
        rule: "LLM-CLIENT-INSTRUCTIONS",
        severity: "high",
        title: "The caller can set the model's instructions",
        where,
        evidence: sys.length ? sys.map((f3) => f3.path).join(", ") : `${roleField.path} allows "system"`,
        detail: "If the client sends the system prompt or a system-role message, every safety rule you wrote into it can be replaced by the caller.",
        fix: 'Keep the system prompt on the server. Accept only user messages from the client and restrict role to "user".',
        refs: [{ standard: LLM_RISK.injection }]
      }));
    }
    const model = req.filter((f3) => MODEL_FIELD.test(f3.name) && !f3.enumValues);
    const tokens = req.filter((f3) => TOKENS_FIELD.test(f3.name) && f3.maximum === void 0);
    if (model.length || tokens.length) {
      out.push(make({
        rule: "LLM-MODEL-CHOICE",
        severity: "medium",
        title: "The caller picks the model or the output size",
        where,
        evidence: [...model, ...tokens].map((f3) => f3.path).join(", "),
        detail: "A free choice of model or max_tokens lets a caller pick the most expensive option every time.",
        fix: "Choose the model on the server, or limit it with an enum, and set a maximum on token counts.",
        refs: [{ standard: API_TOP10.API4 }]
      }));
    }
    const pii = req.filter((f3) => PII_FIELD.test(f3.name));
    if (pii.length) {
      out.push(make({
        rule: "LLM-PII-IN",
        severity: "medium",
        title: "Personal data is sent to the model",
        where,
        evidence: pii.map((f3) => f3.path).slice(0, 4).join(", "),
        detail: "Personal fields sent to a model provider may be logged, retained or used outside your control, and can come back in another user's answer.",
        fix: "Send ids instead of personal data, redact or pseudonymise before the call, and check the provider's retention terms.",
        refs: [{ standard: LLM_RISK.disclosure }]
      }));
    }
    if (!documentsLimit2(op)) {
      out.push(make({
        rule: "LLM-COST-LIMIT",
        severity: "high",
        title: "An AI endpoint shows no rate or spend limit",
        where,
        detail: "Every call costs money at the model provider. Without a limit, one script can run up the bill or starve other users.",
        fix: "Rate-limit per user, set a daily token or spend budget, return 429 when it is reached and document it.",
        refs: [{ standard: API_TOP10.API4 }]
      }));
    }
    const render = op.responseFields.filter((f3) => RENDER_FIELD.test(f3.name) || f3.format === "html");
    if (render.length) {
      out.push(make({
        rule: "LLM-RAW-OUTPUT",
        severity: "medium",
        title: "Model output is returned ready to render",
        where,
        evidence: render.map((f3) => f3.path).join(", "),
        detail: "Model output can contain markup, links and images it copied from what it read. Rendered as-is, it can run script or load content from other hosts.",
        fix: "Return plain text, escape it before rendering, and drop links and images to hosts you have not allow-listed.",
        refs: [{ standard: LLM_RISK.output }]
      }));
    }
  }
  return out;
}
var SAFEGUARDS = [
  { id: "approval", title: "No confirmation before high-impact actions", label: "Actions that move money, delete data or change access wait for a person to confirm.", why: "An agent acts on text it has read; a confirmation step stops one misread instruction from becoming a real action.", severity: "high", standard: LLM_RISK.agency },
  { id: "identity", title: "The agent uses a shared key, not the user's token", label: "The agent calls the API with the signed-in user's own token, never a shared service key.", why: "With a shared key the API cannot tell users apart, so every ownership check passes.", severity: "high", standard: API_TOP10.API1 },
  { id: "scopes", title: "The agent's token is broader than its tools", label: "The agent's token holds only the scopes its tools need.", why: "Least privilege limits what a misled agent can reach.", severity: "medium", standard: API_TOP10.API5 },
  { id: "log", title: "Tool calls are not fully logged", label: "Every tool call is logged with user, tool, arguments, result, time and conversation id.", why: 'Without these six fields you cannot answer "who did this, and why" after an incident.', severity: "medium" },
  { id: "pinned", title: "Tool versions are not pinned or reviewed", label: "Tool servers are pinned to a reviewed version, and changed tool text is reviewed before release.", why: "A tool definition is code the model reads; an unreviewed update can change what the agent does.", severity: "medium", standard: LLM_RISK.supply },
  { id: "egress", title: "Outbound hosts are not restricted", label: "The agent reaches only allow-listed hosts, and its answers cannot load links or images from other hosts.", why: "Outbound links and images are how data leaves a conversation.", severity: "high", standard: LLM_RISK.output },
  { id: "untrusted", title: "Outside content is not kept apart from instructions", label: "Documents, emails and web pages the agent reads are handled as data, kept apart from its instructions.", why: "Content from outside is the main way unwanted instructions reach a model.", severity: "high", standard: LLM_RISK.injection },
  { id: "limits", title: "No per-user limits on agent use", label: "Each user has limits on tool calls, tokens and spend per day.", why: "Limits cap the damage of a loop, a bug or abuse.", severity: "medium", standard: API_TOP10.API4 }
];
function checkSafeguards(inPlace) {
  return SAFEGUARDS.filter((s) => !inPlace[s.id]).map((s) => make({
    rule: `AGENT-${s.id.toUpperCase()}`,
    severity: s.severity,
    title: s.title,
    where: "agent safeguards",
    detail: s.why,
    fix: s.label,
    refs: s.standard ? [{ standard: s.standard }] : []
  }));
}

// src/engine/report.ts
var ENGINE_VERSION = "1.0.0";
var WEIGHT = { critical: 24, high: 10, medium: 4, low: 1, info: 0 };
function gradeFindings(findings) {
  const perRule = /* @__PURE__ */ new Map();
  let penalty = 0;
  for (const f3 of [...findings].sort((a, b) => severityRank(a.severity) - severityRank(b.severity))) {
    const n = perRule.get(f3.rule) ?? 0;
    perRule.set(f3.rule, n + 1);
    penalty += WEIGHT[f3.severity] / (1 + n * 0.75);
  }
  let score = Math.round(100 * Math.exp(-penalty / 90));
  const hasCritical = findings.some((f3) => f3.severity === "critical");
  if (hasCritical) score = Math.min(score, 59);
  const letter = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";
  return { letter, score };
}
function countBySeverity(findings) {
  const out = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f3 of findings) out[f3.severity]++;
  return out;
}
function sortFindings(findings) {
  return [...findings].sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.rule.localeCompare(b.rule) || a.where.localeCompare(b.where));
}
function analyze(input) {
  const findings = [];
  const errors = [];
  const inputs = [];
  let api = null;
  let release = null;
  let jwt = null;
  let toolCount = 0;
  if (input.spec?.trim()) {
    try {
      api = parseApi(input.spec);
      inputs.push("spec");
      findings.push(...checkApi(api), ...checkAiSurface(api));
    } catch (e) {
      errors.push({ input: "spec", message: e.message });
    }
  }
  if (input.previousSpec?.trim()) {
    if (!api) {
      if (input.spec?.trim()) {
      } else errors.push({ input: "previousSpec", message: "Add the new version of the spec to compare against." });
    } else {
      try {
        release = diffApis(parseApi(input.previousSpec), api);
        inputs.push("release");
        findings.push(...release.findings);
      } catch (e) {
        errors.push({ input: "previousSpec", message: e.message });
      }
    }
  }
  if (input.response?.trim()) {
    const res = checkResponse(input.response, input.responseOptions ?? {});
    if (!/:/.test(input.response)) errors.push({ input: "response", message: "No headers found. Paste the response with its headers, for example the output of curl -i." });
    else {
      inputs.push("response");
      findings.push(...res);
    }
  }
  if (input.jwt?.trim()) {
    try {
      const r = checkJwt(input.jwt, Math.floor((input.now ?? /* @__PURE__ */ new Date()).getTime() / 1e3));
      jwt = r.decoded;
      inputs.push("token");
      findings.push(...r.findings);
    } catch (e) {
      errors.push({ input: "jwt", message: e.message });
    }
  }
  if (input.tools?.trim()) {
    try {
      const tools = parseTools(input.tools);
      toolCount = tools.length;
      inputs.push("tools");
      findings.push(...checkTools(tools));
    } catch (e) {
      errors.push({ input: "tools", message: e.message });
    }
  }
  if (input.safeguards) {
    inputs.push("safeguards");
    findings.push(...checkSafeguards(input.safeguards));
  }
  const sorted = sortFindings(findings);
  const bySeverity = countBySeverity(sorted);
  return {
    generatedAt: (input.now ?? /* @__PURE__ */ new Date()).toISOString(),
    engineVersion: ENGINE_VERSION,
    api,
    inputs,
    findings: sorted,
    docsScore: api ? docsScore(api) : null,
    grade: gradeFindings(sorted),
    bySeverity,
    worst: SEVERITY_ORDER.find((s) => bySeverity[s] > 0) ?? null,
    release,
    jwt,
    toolCount,
    errors
  };
}
function failsGate(report, failOn) {
  if (failOn === "none") return false;
  return report.findings.some((f3) => severityRank(f3.severity) <= severityRank(failOn));
}

// src/engine/fixes.ts
var LANGUAGE = {
  express: "javascript",
  fastapi: "python",
  django: "python",
  laravel: "php",
  spring: "java"
};
function family(drafts) {
  const out = {};
  for (const framework of Object.keys(drafts)) {
    const { code, note } = drafts[framework];
    const snippet2 = { framework, language: LANGUAGE[framework], code: code.replace(/^\n+/, "").trimEnd() };
    if (note) snippet2.note = note;
    out[framework] = snippet2;
  }
  return out;
}
var FIXES = {
  // ---------- API1: object level authorization ----------
  ownership: family({
    express: {
      note: "Uses node-postgres (pg); the same owner_id condition applies with any ORM or query builder.",
      code: `
import express from 'express';
import { requireAuth } from './auth.js';
import { pool } from './db.js';

export const orders = express.Router();

orders.get('/orders/:id', requireAuth, async (req, res) => {
  // The owner comes from the verified session, never from the request.
  const { rows } = await pool.query(
    'SELECT id, status, total_cents, currency, created_at FROM orders WHERE id = $1 AND owner_id = $2',
    [req.params.id, req.user.id]
  );
  // Same 404 for "missing" and "not yours", so ids cannot be probed.
  if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
  res.json(rows[0]);
});

// Writes are scoped the same way: a DELETE that matches no row removes nothing.
orders.delete('/orders/:id', requireAuth, async (req, res) => {
  const result = await pool.query('DELETE FROM orders WHERE id = $1 AND owner_id = $2', [req.params.id, req.user.id]);
  res.status(result.rowCount === 0 ? 404 : 204).end();
});
`
    },
    fastapi: {
      code: `
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import current_user
from .db import get_db
from .models import Order, User
from .schemas import OrderOut

router = APIRouter()


@router.get("/orders/{order_id}", response_model=OrderOut)
def get_order(order_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    # Scope the query to the caller; never accept a user id from the client.
    order = db.scalar(select(Order).where(Order.id == order_id, Order.owner_id == user.id))
    if order is None:
        # Same 404 for "missing" and "not yours", so ids cannot be probed.
        raise HTTPException(status_code=404, detail="not_found")
    return order
`
    },
    django: {
      note: "Never set queryset = Order.objects.all() on a view that serves one user's data.",
      code: `
from rest_framework import permissions, viewsets

from .models import Order
from .serializers import OrderSerializer


class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Every lookup (retrieve, update, destroy) runs against this queryset,
        # so another user's id returns 404 instead of their order.
        return Order.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        # The owner is set from the session, never from the request body.
        serializer.save(owner=self.request.user)
`
    },
    laravel: {
      note: "Route model binding on its own (Order $order) does not check ownership; scope the query or add a policy.",
      code: `
<?php

namespace App\\Http\\Controllers;

use App\\Http\\Resources\\OrderResource;
use App\\Models\\Order;
use Illuminate\\Http\\Request;

class OrderController extends Controller
{
    public function show(Request $request, int $id)
    {
        // Scope to the authenticated user; firstOrFail() gives the same 404
        // for "missing" and "not yours", so ids cannot be probed.
        $order = Order::where('id', $id)
            ->where('owner_id', $request->user()->id)
            ->firstOrFail();

        return new OrderResource($order);
    }

    public function destroy(Request $request, int $id)
    {
        $request->user()->orders()->findOrFail($id)->delete();

        return response()->noContent();
    }
}
`
    },
    spring: {
      code: `
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

interface OrderRepository extends JpaRepository<Order, Long> {
    Optional<Order> findByIdAndOwnerId(Long id, String ownerId);
}

@RestController
@RequestMapping("/orders")
class OrderController {
    private final OrderRepository orders;

    OrderController(OrderRepository orders) { this.orders = orders; }

    @GetMapping("/{id}")
    OrderView get(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        // The owner comes from the verified token, never from the request.
        return orders.findByIdAndOwnerId(id, jwt.getSubject())
                .map(OrderView::from)
                // Same 404 for "missing" and "not yours", so ids cannot be probed.
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
}
`
    }
  }),
  // ---------- API2: authentication ----------
  "require-auth": family({
    express: {
      note: "One app-level check before every router means a route added later cannot be left open by accident.",
      code: `
import express from 'express';
import { verifyAccessToken } from './tokens.js';
import { invoices, orders, refunds } from './routes.js';

const app = express();

// The only routes reachable without a user. Everything else is denied by default.
const PUBLIC_ROUTES = new Set(['GET /health', 'POST /auth/login']);

app.use(async (req, res, next) => {
  if (PUBLIC_ROUTES.has(\`\${req.method} \${req.path}\`)) return next();
  const header = req.get('authorization') ?? ''; // header only, never ?api_key= in the URL
  try {
    if (!header.startsWith('Bearer ')) throw new Error('missing token');
    req.user = await verifyAccessToken(header.slice(7)); // signature, exp, iss, aud
    return next();
  } catch {
    return res.set('WWW-Authenticate', 'Bearer').status(401).json({ error: 'unauthorized' });
  }
});

app.use(orders);
app.use(refunds);
app.use(invoices);
`
    },
    fastapi: {
      code: `
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .routers import health, invoices, orders, refunds
from .tokens import verify_access_token

bearer = HTTPBearer(auto_error=False)  # Authorization header only, never ?api_key=


def require_user(request: Request, creds: HTTPAuthorizationCredentials | None = Depends(bearer)):
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, headers={"WWW-Authenticate": "Bearer"})
    request.state.user = verify_access_token(creds.credentials)  # raises 401 on a bad token
    return request.state.user


# Deny by default: every route under this router requires a user.
protected = APIRouter(dependencies=[Depends(require_user)])
protected.include_router(orders.router)
protected.include_router(refunds.router)
protected.include_router(invoices.router)

app = FastAPI()
app.include_router(protected)
app.include_router(health.router)  # explicit opt-out: the only public routes
`
    },
    django: {
      note: "Uses djangorestframework-simplejwt; for plain Django views outside DRF, add LoginRequiredMiddleware (Django 5.1+).",
      code: `
# settings.py: deny by default for every DRF view.
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

# views.py: public endpoints opt out explicitly, one at a time.
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"status": "ok"})
`
    },
    laravel: {
      note: "Requires Laravel Sanctum (php artisan install:api), which reads the token from the Authorization header.",
      code: `
<?php
// routes/api.php

use App\\Http\\Controllers\\AuthController;
use App\\Http\\Controllers\\InvoiceController;
use App\\Http\\Controllers\\OrderController;
use App\\Http\\Controllers\\RefundController;
use Illuminate\\Support\\Facades\\Route;

// Explicit opt-out: the only public routes.
Route::get('/health', fn () => ['status' => 'ok']);
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:login');

// Deny by default: Sanctum checks the bearer token and returns 401 without one.
Route::middleware('auth:sanctum')->group(function () {
    Route::apiResource('orders', OrderController::class);
    Route::post('/refunds', [RefundController::class, 'store']);
    Route::get('/invoices/{invoice}', [InvoiceController::class, 'show']);
});
`
    },
    spring: {
      note: "Needs spring-boot-starter-oauth2-resource-server and spring.security.oauth2.resourceserver.jwt.issuer-uri.",
      code: `
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
class SecurityConfig {

    @Bean
    SecurityFilterChain api(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                // Explicit opt-out for the few public routes.
                .requestMatchers(HttpMethod.GET, "/health").permitAll()
                // Deny by default: everything else needs a valid bearer token.
                .anyRequest().authenticated())
            .oauth2ResourceServer(oauth -> oauth.jwt(Customizer.withDefaults()))
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
        return http.build();
    }
}
`
    }
  }),
  "require-scope": family({
    express: {
      note: "Give each client only the scopes it needs; a token that carries every scope defeats the check.",
      code: `
import express from 'express';
import { createRefund, deleteOrder, getRefund } from './handlers.js';

// Deny by default: the route runs only if the token carries every listed scope.
export function requireScope(...needed) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' });
    const granted = new Set(String(req.user.scope ?? '').split(' ').filter(Boolean));
    if (needed.length === 0 || !needed.every((s) => granted.has(s))) {
      res.set('WWW-Authenticate', \`Bearer error="insufficient_scope", scope="\${needed.join(' ')}"\`);
      return res.status(403).json({ error: 'insufficient_scope' });
    }
    return next();
  };
}

export const refunds = express.Router();
refunds.get('/refunds/:id', requireScope('refunds:read'), getRefund);
refunds.post('/refunds', requireScope('refunds:write'), createRefund);
// Admin actions need their own scope; being signed in is not enough.
refunds.delete('/admin/orders/:id', requireScope('admin:orders'), deleteOrder);
`
    },
    fastapi: {
      code: `
from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security import SecurityScopes

from .auth import current_user  # verifies the token; user.scopes comes from its claims
from .schemas import RefundIn
from .services import orders, refunds


def require_scopes(security_scopes: SecurityScopes, user=Depends(current_user)):
    required = set(security_scopes.scopes)
    # Deny by default: a route that declares no scopes is closed, not open.
    if not required or not required <= set(user.scopes):
        raise HTTPException(403, "insufficient_scope",
                            headers={"WWW-Authenticate": f'Bearer scope="{security_scopes.scope_str}"'})
    return user


router = APIRouter()


@router.post("/refunds", status_code=201)
def create_refund(body: RefundIn, user=Security(require_scopes, scopes=["refunds:write"])):
    return refunds.create(body, requested_by=user.id)


@router.delete("/admin/orders/{order_id}", status_code=204)
def delete_order(order_id: int, user=Security(require_scopes, scopes=["admin"])):
    orders.delete(order_id, deleted_by=user.id)
`
    },
    django: {
      note: "Here request.auth is the simplejwt AccessToken; adapt the scope lookup to your token class.",
      code: `
from rest_framework.permissions import BasePermission, IsAdminUser, IsAuthenticated
from rest_framework.viewsets import ModelViewSet

from .models import Order, Refund
from .serializers import OrderSerializer, RefundSerializer


class HasScope(BasePermission):
    # Deny by default: an action with no declared scopes is refused.
    def has_permission(self, request, view):
        required = getattr(view, "required_scopes", {}).get(view.action)
        if not required or request.auth is None:
            return False
        granted = set(str(request.auth.get("scope", "")).split())
        return set(required) <= granted


class RefundViewSet(ModelViewSet):
    serializer_class = RefundSerializer
    permission_classes = [IsAuthenticated, HasScope]
    required_scopes = {"list": ["refunds:read"], "retrieve": ["refunds:read"], "create": ["refunds:write"]}

    def get_queryset(self):
        return Refund.objects.filter(order__owner=self.request.user)


class AdminOrderViewSet(ModelViewSet):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]  # staff role, checked on the server
`
    },
    laravel: {
      note: "Issue tokens with explicit abilities, e.g. createToken('reports', ['refunds:read']), never the default ['*'].",
      code: `
<?php
// routes/api.php

use App\\Http\\Controllers\\AdminOrderController;
use App\\Http\\Controllers\\RefundController;
use Illuminate\\Support\\Facades\\Route;
use Laravel\\Sanctum\\Http\\Middleware\\CheckAbilities;

Route::middleware('auth:sanctum')->group(function () {
    // Each route names the token ability it needs; a token without it gets 403.
    Route::get('/refunds/{refund}', [RefundController::class, 'show'])
        ->middleware(CheckAbilities::class.':refunds:read');
    Route::post('/refunds', [RefundController::class, 'store'])
        ->middleware(CheckAbilities::class.':refunds:write');

    // Admin routes check the role on the server through a Gate.
    Route::delete('/admin/orders/{order}', [AdminOrderController::class, 'destroy'])
        ->middleware('can:admin');
});

// app/Providers/AppServiceProvider.php, inside boot()
// (imports: App\\Models\\User, Illuminate\\Support\\Facades\\Gate):
Gate::define('admin', fn (User $user) => $user->role === 'admin');
`
    },
    spring: {
      note: "Spring maps each scope in the token to a SCOPE_ authority; for method-level checks use @PreAuthorize with hasAuthority('SCOPE_refunds:write').",
      code: `
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
class SecurityConfig {

    @Bean
    SecurityFilterChain api(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.GET, "/refunds/**").hasAuthority("SCOPE_refunds:read")
                .requestMatchers(HttpMethod.POST, "/refunds").hasAuthority("SCOPE_refunds:write")
                .requestMatchers("/admin/**").hasAuthority("SCOPE_admin")
                .requestMatchers(HttpMethod.GET, "/health").permitAll()
                // Deny by default: a route nobody mapped above is refused, not open.
                .anyRequest().denyAll())
            .oauth2ResourceServer(oauth -> oauth.jwt(Customizer.withDefaults()));
        return http.build();
    }
}
`
    }
  }),
  // ---------- API3: property level authorization ----------
  "response-allowlist": family({
    express: {
      note: "npm install zod; never res.json() a database row or ORM object directly.",
      code: `
import express from 'express';
import { z } from 'zod';
import { orders } from './repo.js';

// Response schema: only these fields leave the server. z.object() drops every
// other key (password_hash, api_token, card_number) when it parses.
const OrderOut = z.object({
  id: z.string(),
  status: z.enum(['pending', 'paid', 'refunded']),
  total_cents: z.number().int(),
  currency: z.string().length(3),
  created_at: z.date(),
  customer: z.object({ id: z.string(), name: z.string(), card_last4: z.string().nullable() }),
});

export const router = express.Router();

router.get('/orders/:id', async (req, res) => {
  const order = await orders.findOwned(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ error: 'not_found' });
  res.json(OrderOut.parse(order));
});
`
    },
    fastapi: {
      code: `
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict

from .deps import owned_order  # loads the order scoped to the current user

router = APIRouter()


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    card_last4: str | None


class OrderOut(BaseModel):
    # Only these fields are serialized; password_hash, api_token and card_number never leave.
    model_config = ConfigDict(from_attributes=True)
    id: int
    status: str
    total_cents: int
    created_at: datetime
    customer: CustomerOut


@router.get("/orders/{order_id}", response_model=OrderOut)
def get_order(order=Depends(owned_order)):
    return order
`
    },
    django: {
      code: `
from rest_framework import serializers

from .models import Customer, Order


class CustomerSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        # Explicit allow-list. Never fields = "__all__" or exclude = [...]: a column
        # added later (password_hash, api_token) would start leaking.
        fields = ["id", "name", "card_last4"]


class OrderSerializer(serializers.ModelSerializer):
    customer = CustomerSummarySerializer(read_only=True)

    class Meta:
        model = Order
        fields = ["id", "status", "total_cents", "currency", "created_at", "customer"]
        read_only_fields = fields
`
    },
    laravel: {
      note: "Also list secrets in the model's $hidden array as a second guard, and never return a model or toArray() directly.",
      code: `
<?php

namespace App\\Http\\Resources;

use Illuminate\\Http\\Request;
use Illuminate\\Http\\Resources\\Json\\JsonResource;

class OrderResource extends JsonResource
{
    // Explicit allow-list. A column added later (password_hash, api_token,
    // card_number) is not returned until someone adds it here.
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status,
            'total_cents' => $this->total_cents,
            'currency' => $this->currency,
            'created_at' => $this->created_at->toIso8601String(),
            'customer' => [
                'id' => $this->customer->id,
                'name' => $this->customer->name,
                'card_last4' => $this->customer->card_last4,
            ],
        ];
    }
}
`
    },
    spring: {
      note: "Return records like this from controllers; @JsonIgnore on entity fields is a weaker deny-list.",
      code: `
import java.time.Instant;

// Controllers return these records, never JPA entities, so fields such as
// passwordHash, apiToken or cardNumber cannot be serialized by accident.
public record OrderView(Long id, String status, long totalCents, String currency,
                        Instant createdAt, CustomerView customer) {

    public static OrderView from(Order o) {
        return new OrderView(o.getId(), o.getStatus().name(), o.getTotalCents(), o.getCurrency(),
                o.getCreatedAt(), CustomerView.from(o.getCustomer()));
    }

    public record CustomerView(Long id, String name, String cardLast4) {
        static CustomerView from(Customer c) {
            return new CustomerView(c.getId(), c.getName(), c.getCardLast4());
        }
    }
}
`
    }
  }),
  "input-allowlist": family({
    express: {
      note: "npm install zod; in zod 4 z.strictObject({...}) is the same as z.object({...}).strict().",
      code: `
import express from 'express';
import { z } from 'zod';
import { orders, toOrderDto } from './orders.js';

// Only these fields are accepted. .strict() rejects unknown keys, so a client
// cannot slip in role, balance, owner_id or status.
const CreateOrder = z.object({
  items: z.array(z.object({
    sku: z.string().max(64),
    quantity: z.number().int().min(1).max(100),
  }).strict()).min(1).max(50),
  shipping_address_id: z.string().uuid(),
  note: z.string().max(500).optional(),
}).strict();

export const router = express.Router();

router.post('/orders', async (req, res) => {
  const parsed = CreateOrder.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ error: 'invalid_body', issues: parsed.error.issues.map((i) => i.message) });
  }
  // Server-owned fields come from the session and the server, never from the body.
  const order = await orders.create({ ...parsed.data, owner_id: req.user.id, status: 'pending' });
  res.status(201).json(toOrderDto(order));
});
`
    },
    fastapi: {
      code: `
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from .auth import current_user
from .services import orders

router = APIRouter()


class OrderItemIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sku: Annotated[str, Field(max_length=64)]
    quantity: Annotated[int, Field(ge=1, le=100)]


class OrderIn(BaseModel):
    # extra="forbid" turns unknown keys (role, balance, owner_id, status) into a 422.
    model_config = ConfigDict(extra="forbid")
    items: Annotated[list[OrderItemIn], Field(min_length=1, max_length=50)]
    shipping_address_id: int
    note: Annotated[str | None, Field(max_length=500)] = None


@router.post("/orders", status_code=201)
def create_order(body: OrderIn, user=Depends(current_user)):
    # Server-owned fields are set here, never bound from the request.
    return orders.create(body, owner_id=user.id, status="pending")
`
    },
    django: {
      code: `
from rest_framework import serializers, viewsets
from rest_framework.permissions import IsAuthenticated

from .models import Order


class OrderWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = ["id", "shipping_address", "note", "status", "total_cents"]
        # Server-owned fields are output only; values sent by the client are ignored.
        read_only_fields = ["id", "status", "total_cents"]

    def to_internal_value(self, data):
        # Reject unknown keys (role, balance, owner) instead of silently dropping them.
        unknown = set(data) - set(self.fields) if isinstance(data, dict) else set()
        if unknown:
            raise serializers.ValidationError({key: "Unknown field." for key in sorted(unknown)})
        return super().to_internal_value(data)


class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderWriteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user, status="pending")
`
    },
    laravel: {
      note: "Calling Model::preventSilentlyDiscardingAttributes() in AppServiceProvider makes non-fillable keys throw instead of vanishing.",
      code: `
<?php
// app/Models/Order.php: only these columns can ever be mass-assigned.
class Order extends Model
{
    protected $fillable = ['shipping_address_id', 'note'];
    protected $attributes = ['status' => 'pending'];
}

// app/Http/Controllers/OrderController.php
public function store(Request $request)
{
    // Reject unknown keys (role, balance, owner_id) instead of ignoring them.
    $unknown = array_diff(array_keys($request->all()), ['shipping_address_id', 'note', 'items']);
    abort_if($unknown !== [], 422, 'Unknown fields: '.implode(', ', $unknown));

    $data = $request->validate([
        'shipping_address_id' => ['required', 'integer'],
        'note' => ['nullable', 'string', 'max:500'],
        'items' => ['required', 'array', 'min:1', 'max:50'],
        'items.*.sku' => ['required', 'string', 'max:64'],
        'items.*.quantity' => ['required', 'integer', 'min:1', 'max:100'],
    ]);

    // owner_id comes from the session. Never Order::create($request->all()).
    $order = $request->user()->orders()->create(Arr::only($data, ['shipping_address_id', 'note']));
    $order->items()->createMany($data['items']);

    return new OrderResource($order);
}
`
    },
    spring: {
      note: "With fail-on-unknown-properties on, a body with an extra key is refused with 400 before the controller runs.",
      code: `
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;

// Request DTO: the only fields a client can set. role, balance, ownerId and
// status do not exist here, so they cannot be bound.
public record CreateOrderRequest(
        @NotNull Long shippingAddressId,
        @Size(max = 500) String note,
        @NotEmpty @Size(max = 50) List<@Valid Item> items) {

    public record Item(@NotBlank @Size(max = 64) String sku, @Min(1) @Max(100) int quantity) {}
}

// application.properties: reject unknown JSON properties (Spring Boot ignores them by default).
// spring.jackson.deserialization.fail-on-unknown-properties=true

// Controller: bind the DTO, never the JPA entity.
@PostMapping("/orders")
@ResponseStatus(HttpStatus.CREATED)
OrderView create(@Valid @RequestBody CreateOrderRequest body, @AuthenticationPrincipal Jwt jwt) {
    // ownerId and status are set on the server, never from the body.
    return OrderView.from(orderService.create(body, jwt.getSubject()));
}
`
    }
  }),
  // ---------- API4: resource consumption ----------
  "page-limit": family({
    express: {
      code: `
import express from 'express';
import { z } from 'zod';
import { pool } from './db.js';

// Hard ceiling on page size, whatever the client asks for.
const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.coerce.number().int().min(0).default(0), // last id of the previous page
});

export const router = express.Router();

router.get('/orders', async (req, res) => {
  const q = ListQuery.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: 'invalid_query' });
  const { limit, cursor } = q.data;
  // Keyset pagination: one extra row tells us whether a next page exists.
  const { rows } = await pool.query(
    'SELECT id, status, total_cents, created_at FROM orders WHERE owner_id = $1 AND id > $2 ORDER BY id LIMIT $3',
    [req.user.id, cursor, limit + 1]
  );
  const page = rows.slice(0, limit);
  res.json({ data: page, next_cursor: rows.length > limit ? page.at(-1).id : null });
});
`
    },
    fastapi: {
      code: `
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from .deps import current_user, get_db
from .models import Order
from .schemas import OrderOut

router = APIRouter()


@router.get("/orders")
def list_orders(
    limit: Annotated[int, Query(ge=1, le=100)] = 20,  # hard max: 100 per page
    cursor: Annotated[int, Query(ge=0)] = 0,  # last id of the previous page
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    rows = db.scalars(
        select(Order)
        .where(Order.owner_id == user.id, Order.id > cursor)
        .order_by(Order.id)
        .limit(limit + 1)  # one extra row tells us whether a next page exists
    ).all()
    page = rows[:limit]
    next_cursor = page[-1].id if len(rows) > limit else None
    return {"data": [OrderOut.model_validate(o) for o in page], "next_cursor": next_cursor}
`
    },
    django: {
      note: "Cursor pagination keeps deep pages cheap; never ship a list endpoint without a paginator.",
      code: `
# settings.py
REST_FRAMEWORK = {
    "DEFAULT_PAGINATION_CLASS": "orders.pagination.OrderCursorPagination",
}

# orders/pagination.py
from rest_framework.pagination import CursorPagination


class OrderCursorPagination(CursorPagination):
    ordering = "-created_at"
    page_size = 20
    page_size_query_param = "limit"
    max_page_size = 100  # ?limit=100000 is capped at 100


# orders/views.py: list endpoints inherit the default; set it explicitly where it matters.
from rest_framework import viewsets

from .models import Order
from .pagination import OrderCursorPagination
from .serializers import OrderSerializer


class OrderViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = OrderSerializer
    pagination_class = OrderCursorPagination

    def get_queryset(self):
        return Order.objects.filter(owner=self.request.user)
`
    },
    laravel: {
      code: `
<?php
// app/Http/Controllers/OrderController.php

public function index(Request $request)
{
    $validated = $request->validate([
        'limit' => ['sometimes', 'integer', 'min:1', 'max:100'], // hard max per page
        'cursor' => ['sometimes', 'string', 'max:512'],
    ]);

    // cursorPaginate() reads ?cursor= and stays fast and stable on deep pages.
    $orders = $request->user()->orders()
        ->orderBy('id')
        ->cursorPaginate($validated['limit'] ?? 20);

    return OrderResource::collection($orders);
}
`
    },
    spring: {
      note: "Limit needs Spring Data 3.2+; if you take a Pageable instead, also set spring.data.web.pageable.max-page-size=100.",
      code: `
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

record OrderPage(List<OrderView> data, Long nextCursor) {}

@Validated
@RestController
class OrderListController {
    private final OrderRepository orders; // findByOwnerIdAndIdGreaterThanOrderByIdAsc(String, Long, Limit)

    OrderListController(OrderRepository orders) { this.orders = orders; }

    @GetMapping("/orders")
    OrderPage list(@RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit, // hard max
                   @RequestParam(defaultValue = "0") @Min(0) long cursor, // last id of the previous page
                   @AuthenticationPrincipal Jwt jwt) {
        // One extra row tells us whether a next page exists.
        List<Order> rows = orders.findByOwnerIdAndIdGreaterThanOrderByIdAsc(jwt.getSubject(), cursor, Limit.of(limit + 1));
        List<Order> page = rows.subList(0, Math.min(limit, rows.size()));
        Long next = rows.size() > limit ? page.get(page.size() - 1).getId() : null;
        return new OrderPage(page.stream().map(OrderView::from).toList(), next);
    }
}
`
    }
  }),
  "upload-limit": family({
    express: {
      note: "npm install multer file-type; written for Express 5, which passes rejected async handlers to the error handler.",
      code: `
import express from 'express';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { attachments } from './repo.js';

const ALLOWED_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5 }, // 5 MB, one file
});

export const router = express.Router();

router.post('/invoices/:id/attachments', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file_required' });
  // Check the real bytes; the client's Content-Type and file name are not trusted.
  const type = await fileTypeFromBuffer(req.file.buffer);
  if (!type || !ALLOWED_TYPES.has(type.mime)) return res.status(415).json({ error: 'unsupported_file' });
  const saved = await attachments.save(req.params.id, req.user.id, req.file.buffer, type.mime);
  res.status(201).json({ id: saved.id });
});

// Multer limit errors become 413 or 400 instead of a 500.
router.use((err, req, res, next) => {
  if (!(err instanceof multer.MulterError)) return next(err);
  res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code.toLowerCase() });
});
`
    },
    fastapi: {
      note: "pip install filetype python-multipart; also cap the body at the proxy (nginx client_max_body_size 6m), because the form is parsed before this code runs.",
      code: `
import filetype
from fastapi import APIRouter, Depends, HTTPException, UploadFile

from .deps import current_user
from .services import attachments

MAX_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_TYPES = {"application/pdf", "image/png", "image/jpeg"}

router = APIRouter()


@router.post("/invoices/{invoice_id}/attachments", status_code=201)
async def upload_attachment(invoice_id: int, file: UploadFile, user=Depends(current_user)):
    # Read at most one byte past the limit instead of trusting Content-Length.
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="file_too_large")
    # Check the real bytes; the client's content type and file name are not trusted.
    kind = filetype.guess(data)
    if kind is None or kind.mime not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="unsupported_file")
    saved = await attachments.save(invoice_id, user.id, data, kind.mime)
    return {"id": saved.id}
`
    },
    django: {
      note: "pip install filetype; also cap the body at the proxy (nginx client_max_body_size 6m), since Django receives the whole upload before validation runs.",
      code: `
import filetype
from rest_framework import serializers

MAX_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_TYPES = {"application/pdf", "image/png", "image/jpeg"}


class AttachmentUploadSerializer(serializers.Serializer):
    file = serializers.FileField(max_length=100, allow_empty_file=False)

    def validate_file(self, upload):
        if upload.size > MAX_BYTES:
            raise serializers.ValidationError("File is larger than 5 MB.")
        # Check the real bytes; the client's content type and file name are not trusted.
        kind = filetype.guess(upload.read(261))
        upload.seek(0)
        if kind is None or kind.mime not in ALLOWED_TYPES:
            raise serializers.ValidationError("Only PDF, PNG and JPEG files are accepted.")
        return upload
`
    },
    laravel: {
      note: "Set upload_max_filesize and post_max_size in php.ini to match, so PHP refuses oversized bodies before your code runs.",
      code: `
<?php

namespace App\\Http\\Controllers;

use App\\Models\\Invoice;
use Illuminate\\Http\\Request;
use Illuminate\\Validation\\Rules\\File;

class InvoiceAttachmentController extends Controller
{
    public function store(Request $request, Invoice $invoice)
    {
        abort_unless($invoice->owner_id === $request->user()->id, 404);

        $request->validate([
            // types() checks the MIME type detected from the content; max() is in KB (5 MB).
            'file' => ['required', File::types(['pdf', 'png', 'jpg'])->max(5 * 1024)],
        ]);

        // Random file name on a private disk: nothing the client sends ends up in the path.
        $path = $request->file('file')->store("invoices/{$invoice->id}", 'local');
        $attachment = $invoice->attachments()->create(['path' => $path]);

        return response()->json(['id' => $attachment->id], 201);
    }
}
`
    },
    spring: {
      note: "Tika is org.apache.tika:tika-core; imports are omitted for length.",
      code: `
// application.properties: oversized requests are refused before the controller runs.
// spring.servlet.multipart.max-file-size=5MB
// spring.servlet.multipart.max-request-size=6MB

@RestController
class InvoiceAttachmentController {
    private static final Set<String> ALLOWED = Set.of("application/pdf", "image/png", "image/jpeg");
    private final Tika tika = new Tika();
    private final AttachmentService attachments;

    InvoiceAttachmentController(AttachmentService attachments) { this.attachments = attachments; }

    @PostMapping(path = "/invoices/{id}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    ResponseEntity<Map<String, Long>> upload(@PathVariable long id, @RequestParam("file") MultipartFile file,
                                             @AuthenticationPrincipal Jwt jwt) throws IOException {
        // Detect the type from the bytes; the client's Content-Type and file name are not trusted.
        String detected = tika.detect(file.getInputStream());
        if (!ALLOWED.contains(detected)) throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        long attachmentId = attachments.save(id, jwt.getSubject(), file.getBytes(), detected);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", attachmentId));
    }
}

@RestControllerAdvice
class UploadErrors {
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<Map<String, String>> tooLarge() {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(Map.of("error", "file_too_large"));
    }
}
`
    }
  }),
  "rate-limit": family({
    express: {
      note: "express-rate-limit v8; use a shared store such as rate-limit-redis when you run more than one instance.",
      code: `
import express from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { apiRouter, authenticate, login } from './app.js';

const limiter = (windowMs, limit, keyGenerator) => rateLimit({
  windowMs,
  limit,
  keyGenerator,
  standardHeaders: 'draft-8', // RateLimit headers; 429 responses also carry Retry-After
  legacyHeaders: false,
  message: { error: 'too_many_requests' },
});

const MIN = 60 * 1000;
// Login is limited per client IP and, separately, per account name, so one
// account cannot be brute-forced from many addresses.
const loginPerIp = limiter(15 * MIN, 20, (req) => ipKeyGenerator(req.ip));
const loginPerAccount = limiter(15 * MIN, 10, (req) => \`acct:\${String(req.body?.email ?? '').toLowerCase()}\`);
// Everything else: per authenticated user, falling back to the client IP.
const perUser = limiter(MIN, 120, (req) => (req.user ? \`user:\${req.user.id}\` : ipKeyGenerator(req.ip)));

const app = express();
app.set('trust proxy', 1); // one proxy in front, so req.ip is the real client
app.post('/auth/login', express.json(), loginPerIp, loginPerAccount, login);
app.use('/api', authenticate, perUser, apiRouter);
`
    },
    fastapi: {
      note: 'pip install slowapi; pass storage_uri="redis://..." to Limiter when you run more than one worker.',
      code: `
from fastapi import Depends, FastAPI, Request, Response
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from .deps import current_user  # also sets request.state.user
from .schemas import LoginIn, RefundIn
from .services import auth, refunds

# Per client IP by default; headers_enabled adds Retry-After to 429 responses.
limiter = Limiter(key_func=get_remote_address, default_limits=["300/minute"], headers_enabled=True)
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


@app.post("/auth/login")
@limiter.limit("10/15minutes")
async def login(request: Request, response: Response, body: LoginIn):
    return await auth.login(body)


@app.post("/refunds", status_code=201)
# Per user: the current_user dependency has run before the limit is checked.
@limiter.limit("20/hour", key_func=lambda request: f"user:{request.state.user.id}")
async def create_refund(request: Request, response: Response, body: RefundIn, user=Depends(current_user)):
    return await refunds.create(body, requested_by=user.id)
`
    },
    django: {
      note: "Throttles count in the Django cache; use a shared cache such as Redis so limits hold across workers.",
      code: `
# settings.py
REST_FRAMEWORK = {
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",  # per client IP
        "rest_framework.throttling.UserRateThrottle",  # per signed-in user
    ],
    "DEFAULT_THROTTLE_RATES": {"anon": "60/min", "user": "600/min", "login": "10/min", "refunds": "20/hour"},
    "NUM_PROXIES": 1,  # trust one proxy hop when reading the client IP
}

# views.py: throttled requests get 429 with a Retry-After header.
from rest_framework import viewsets
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView


class LoginThrottle(AnonRateThrottle):
    scope = "login"


class LoginView(TokenObtainPairView):
    throttle_classes = [LoginThrottle]


class RefundViewSet(viewsets.ModelViewSet):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "refunds"  # counted per user for signed-in requests
`
    },
    laravel: {
      note: "Set CACHE_STORE=redis so the counters are shared by every server.",
      code: `
<?php
// app/Providers/AppServiceProvider.php
use Illuminate\\Cache\\RateLimiting\\Limit;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\RateLimiter;

public function boot(): void
{
    // Per signed-in user, falling back to the client IP.
    RateLimiter::for('api', function (Request $request) {
        return Limit::perMinute(120)->by($request->user()?->id ?: $request->ip());
    });

    // Login: per IP and, separately, per account, so one account cannot be
    // brute-forced from many addresses.
    RateLimiter::for('login', function (Request $request) {
        return [
            Limit::perMinute(10)->by('ip:'.$request->ip()),
            Limit::perHour(20)->by('email:'.strtolower((string) $request->input('email'))),
        ];
    });
}

// routes/api.php: the throttle middleware answers 429 with Retry-After.
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:login');
Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
    Route::apiResource('orders', OrderController::class);
    Route::post('/refunds', [RefundController::class, 'store']);
});
`
    },
    spring: {
      note: "Needs com.bucket4j:bucket4j_jdk17-core and Caffeine (imports omitted for length), plus Bucket4j's Redis integration when you run more than one instance.",
      code: `
// Register after authentication:
// http.addFilterAfter(new RateLimitFilter(), BearerTokenAuthenticationFilter.class);
public class RateLimitFilter extends OncePerRequestFilter {
    private final Cache<String, Bucket> buckets = Caffeine.newBuilder()
            .maximumSize(100_000).expireAfterAccess(Duration.ofMinutes(10)).build();

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        // Per authenticated user, falling back to the client IP.
        String key = SecurityContextHolder.getContext().getAuthentication() instanceof JwtAuthenticationToken jwt
                ? "user:" + jwt.getName() : "ip:" + req.getRemoteAddr();
        Bucket bucket = buckets.get(key, k -> Bucket.builder()
                .addLimit(limit -> limit.capacity(120).refillGreedy(120, Duration.ofMinutes(1)))
                .build());
        ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);
        if (probe.isConsumed()) {
            res.setHeader("RateLimit-Remaining", String.valueOf(probe.getRemainingTokens()));
            chain.doFilter(req, res);
            return;
        }
        long waitSeconds = TimeUnit.NANOSECONDS.toSeconds(probe.getNanosToWaitForRefill()) + 1;
        res.setStatus(429);
        res.setHeader("Retry-After", String.valueOf(waitSeconds));
        res.setContentType("application/json");
        res.getWriter().write("{\\"error\\":\\"too_many_requests\\"}");
    }
}
`
    }
  }),
  // ---------- API6: sensitive business flows ----------
  idempotency: family({
    express: {
      note: "Uses ioredis; a fuller version also stores a hash of the body and answers 422 when a key is reused with a different body.",
      code: `
import express from 'express';
import { requireScope } from './auth.js';
import { redis } from './redis.js'; // ioredis client
import { issueRefund } from './refunds.js';

const DAY = 24 * 60 * 60;
export const router = express.Router();

router.post('/refunds', requireScope('refunds:write'), async (req, res, next) => {
  const key = req.get('Idempotency-Key');
  if (!key || !/^[A-Za-z0-9_-]{16,64}$/.test(key)) {
    return res.status(400).json({ error: 'idempotency_key_required' });
  }
  const slot = \`idem:refunds:\${req.user.id}:\${key}\`;
  // SET NX claims the key atomically; a repeat reads the stored result instead.
  if ((await redis.set(slot, 'pending', 'EX', DAY, 'NX')) === null) {
    const stored = await redis.get(slot);
    if (stored === null || stored === 'pending') return res.status(409).json({ error: 'request_in_progress' });
    return res.status(201).json(JSON.parse(stored)); // replay the first result: no second refund
  }
  try {
    const refund = await issueRefund({ orderId: req.body.order_id, amountCents: req.body.amount_cents, userId: req.user.id });
    const result = { id: refund.id, status: refund.status, amount_cents: refund.amount_cents };
    await redis.set(slot, JSON.stringify(result), 'EX', DAY);
    return res.status(201).json(result);
  } catch (err) {
    await redis.del(slot); // a failed attempt can be retried with the same key
    return next(err);
  }
});
`
    },
    fastapi: {
      note: "Uses redis.asyncio; any store with an atomic insert-if-absent (a unique index in SQL) works the same way.",
      code: `
import json

from fastapi import APIRouter, Depends, Header, HTTPException

from .deps import current_user, redis  # redis.asyncio.Redis(..., decode_responses=True)
from .refunds import RefundIn, issue_refund

router = APIRouter()


@router.post("/refunds", status_code=201)
async def create_refund(body: RefundIn, user=Depends(current_user),
                        key: str = Header(alias="Idempotency-Key", min_length=16, max_length=64)):
    slot = f"idem:refunds:{user.id}:{key}"
    # SET NX claims the key atomically; a repeat reads the stored result instead.
    if not await redis.set(slot, "pending", ex=86400, nx=True):
        stored = await redis.get(slot)
        if stored in (None, "pending"):
            raise HTTPException(409, "request_in_progress")
        return json.loads(stored)  # replay the first result: no second refund
    try:
        refund = await issue_refund(body, user_id=user.id)
    except Exception:
        await redis.delete(slot)  # a failed attempt can be retried with the same key
        raise
    result = {"id": refund.id, "status": refund.status, "amount_cents": refund.amount_cents}
    await redis.set(slot, json.dumps(result), ex=86400)
    return result
`
    },
    django: {
      note: "cache.add() is atomic on the Redis and Memcached backends; the local-memory cache only works inside one process.",
      code: `
from django.core.cache import cache
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import RefundSerializer


class RefundCreateView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        key = request.headers.get("Idempotency-Key", "")
        if not 16 <= len(key) <= 64:
            return Response({"error": "idempotency_key_required"}, status=400)
        slot = f"idem:refunds:{request.user.pk}:{key}"
        # cache.add() writes only if the key is absent, so exactly one request claims it.
        if not cache.add(slot, "pending", timeout=86400):
            stored = cache.get(slot)
            if stored in (None, "pending"):
                return Response({"error": "request_in_progress"}, status=409)
            return Response(stored, status=201)  # replay the first result: no second refund
        serializer = RefundSerializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
            serializer.save(requested_by=request.user)
        except Exception:
            cache.delete(slot)  # a failed attempt can be retried with the same key
            raise
        cache.set(slot, dict(serializer.data), timeout=86400)
        return Response(serializer.data, status=201)
`
    },
    laravel: {
      note: "Cache::add() is atomic on the redis, memcached and database stores; avoid the file and array stores here.",
      code: `
<?php
// app/Http/Controllers/RefundController.php

public function store(Request $request)
{
    $key = (string) $request->header('Idempotency-Key');
    abort_unless(preg_match('/^[A-Za-z0-9_-]{16,64}$/', $key) === 1, 400, 'Idempotency-Key header required.');
    $data = $request->validate([
        'order_id' => ['required', 'integer'],
        'amount_cents' => ['required', 'integer', 'min:1'],
    ]);
    $slot = "idem:refunds:{$request->user()->id}:{$key}";

    // Cache::add() writes only if the key is absent, so exactly one request claims it.
    if (! Cache::add($slot, 'pending', now()->addDay())) {
        $stored = Cache::get($slot);
        abort_if($stored === null || $stored === 'pending', 409, 'Request still in progress.');
        return response()->json($stored, 201); // replay the first result: no second refund
    }

    try {
        $refund = $this->refunds->issue($request->user(), $data);
    } catch (\\Throwable $e) {
        Cache::forget($slot); // a failed attempt can be retried with the same key
        throw $e;
    }
    $result = ['id' => $refund->id, 'status' => $refund->status, 'amount_cents' => $refund->amount_cents];
    Cache::put($slot, $result, now()->addDay());
    return response()->json($result, 201);
}
`
    },
    spring: {
      note: "redis is a StringRedisTemplate and json the Jackson ObjectMapper; put @Validated on the controller so @Pattern is enforced.",
      code: `
@PostMapping("/refunds")
ResponseEntity<RefundView> create(
        @RequestHeader("Idempotency-Key") @Pattern(regexp = "[A-Za-z0-9_-]{16,64}") String key,
        @Valid @RequestBody RefundRequest body,
        @AuthenticationPrincipal Jwt jwt) throws JsonProcessingException {
    String slot = "idem:refunds:" + jwt.getSubject() + ":" + key;
    // setIfAbsent is atomic, so only the first request with this key runs.
    if (!Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(slot, "pending", Duration.ofDays(1)))) {
        String stored = redis.opsForValue().get(slot);
        if (stored == null || stored.equals("pending")) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "request_in_progress");
        }
        // Replay the first result: no second refund.
        return ResponseEntity.status(HttpStatus.CREATED).body(json.readValue(stored, RefundView.class));
    }
    try {
        RefundView created = RefundView.from(refunds.issue(body, jwt.getSubject()));
        redis.opsForValue().set(slot, json.writeValueAsString(created), Duration.ofDays(1));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    } catch (RuntimeException e) {
        redis.delete(slot); // a failed attempt can be retried with the same key
        throw e;
    }
}
`
    }
  }),
  // ---------- API7: server side request forgery ----------
  "ssrf-guard": family({
    express: {
      note: "npm install undici ipaddr.js; import fetch from undici as well, so the pinned dispatcher is honoured.",
      code: `
import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import { Agent, fetch } from 'undici';

const ALLOWED_HOSTS = new Set(['files.partner.example', 'hooks.partner.example']);

export async function fetchPartnerFile(raw) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname) || url.username || url.password) {
    throw new Error('url_not_allowed');
  }
  // Only public unicast addresses: no 127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1 or fc00::/7.
  const addrs = await lookup(url.hostname, { all: true });
  if (addrs.length === 0 || addrs.some((a) => ipaddr.process(a.address).range() !== 'unicast')) {
    throw new Error('url_not_allowed');
  }
  // Pin the socket to the checked address, so DNS cannot change between check and connect.
  const { address, family } = addrs[0];
  const dispatcher = new Agent({
    maxResponseSize: 1024 * 1024, // 1 MB cap on the body
    connect: { lookup: (_h, opts, cb) => (opts.all ? cb(null, [{ address, family }]) : cb(null, address, family)) },
  });
  try {
    const res = await fetch(url, { dispatcher, redirect: 'error', signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error('upstream_error');
    return Buffer.from(await res.arrayBuffer());
  } finally {
    await dispatcher.close();
  }
}
`
    },
    fastapi: {
      note: "pip install httpx; the sni_hostname extension keeps certificate checks on the real host name while connecting to the pinned IP.",
      code: `
import asyncio
import ipaddress
from urllib.parse import urlsplit

import httpx

ALLOWED_HOSTS = {"files.partner.example", "hooks.partner.example"}


async def fetch_partner_file(raw_url: str) -> bytes:
    url = urlsplit(raw_url)
    if url.scheme != "https" or url.hostname not in ALLOWED_HOSTS or url.username:
        raise ValueError("url_not_allowed")
    infos = await asyncio.get_running_loop().getaddrinfo(url.hostname, url.port or 443)
    addrs = [ipaddress.ip_address(info[4][0]) for info in infos]
    if not all(a.is_global for a in addrs):  # no 127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1, fc00::/7
        raise ValueError("url_not_allowed")
    # Connect to the checked address; Host and SNI keep TLS verification on the real name.
    ip = f"[{addrs[0]}]" if addrs[0].version == 6 else str(addrs[0])
    pinned = url._replace(netloc=f"{ip}:{url.port or 443}").geturl()
    async with httpx.AsyncClient(follow_redirects=False, timeout=5.0) as client:
        async with client.stream("GET", pinned, headers={"Host": url.hostname},
                                 extensions={"sni_hostname": url.hostname}) as resp:
            resp.raise_for_status()
            body = bytearray()
            async for chunk in resp.aiter_bytes():
                body += chunk
                if len(body) > 1024 * 1024:  # 1 MB cap
                    raise ValueError("response_too_large")
            return bytes(body)
`
    },
    django: {
      note: "pip install httpx; call this from the view or task instead of passing the user URL to requests.get().",
      code: `
import ipaddress
import socket
from urllib.parse import urlsplit

import httpx

ALLOWED_HOSTS = {"files.partner.example", "hooks.partner.example"}


def fetch_partner_file(raw_url: str) -> bytes:
    url = urlsplit(raw_url)
    if url.scheme != "https" or url.hostname not in ALLOWED_HOSTS or url.username:
        raise ValueError("url_not_allowed")
    infos = socket.getaddrinfo(url.hostname, url.port or 443, type=socket.SOCK_STREAM)
    addrs = [ipaddress.ip_address(info[4][0]) for info in infos]
    if not all(a.is_global for a in addrs):  # no 127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1, fc00::/7
        raise ValueError("url_not_allowed")
    # Connect to the checked address; Host and SNI keep TLS verification on the real name.
    ip = f"[{addrs[0]}]" if addrs[0].version == 6 else str(addrs[0])
    pinned = url._replace(netloc=f"{ip}:{url.port or 443}").geturl()
    with httpx.Client(follow_redirects=False, timeout=5.0) as client:
        with client.stream("GET", pinned, headers={"Host": url.hostname},
                           extensions={"sni_hostname": url.hostname}) as resp:
            resp.raise_for_status()
            body = bytearray()
            for chunk in resp.iter_bytes():
                body += chunk
                if len(body) > 1024 * 1024:  # 1 MB cap
                    raise ValueError("response_too_large")
            return bytes(body)
`
    },
    laravel: {
      note: "FILTER_FLAG_GLOBAL_RANGE needs PHP 8.2+, and curl 8.4+ enforces CURLOPT_MAXFILESIZE during the transfer.",
      code: `
<?php

use Illuminate\\Support\\Facades\\Http;

final class PartnerFileFetcher
{
    private const ALLOWED_HOSTS = ['files.partner.example', 'hooks.partner.example'];

    public function fetch(string $url): string
    {
        $parts = parse_url($url);
        $host = $parts['host'] ?? '';
        if (($parts['scheme'] ?? '') !== 'https' || ! in_array($host, self::ALLOWED_HOSTS, true) || isset($parts['user'])) {
            throw new \\InvalidArgumentException('url_not_allowed');
        }
        // Every resolved address must be public: FILTER_FLAG_GLOBAL_RANGE rejects
        // 127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1 and fc00::/7.
        $ips = array_map(fn (array $r) => $r['ip'] ?? $r['ipv6'], dns_get_record($host, DNS_A | DNS_AAAA) ?: []);
        if ($ips === [] || in_array(false, array_map(fn ($ip) => filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_GLOBAL_RANGE), $ips), true)) {
            throw new \\InvalidArgumentException('url_not_allowed');
        }
        $pin = str_contains($ips[0], ':') ? "[{$ips[0]}]" : $ips[0];

        return Http::timeout(5)->withoutRedirecting()->withOptions(['curl' => [
            CURLOPT_RESOLVE => ["{$host}:".($parts['port'] ?? 443).":{$pin}"], // connect only to the checked address
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_MAXFILESIZE => 1048576, // 1 MB
        ]])->get($url)->throw()->body();
    }
}
`
    },
    spring: {
      note: "Uses Apache HttpClient 5 (httpclient5) under RestClient; imports are omitted for length.",
      code: `
// The check runs inside the connection's own DNS lookup, so the address checked is the address used.
class PublicOnlyDnsResolver extends SystemDefaultDnsResolver {
    static final Set<String> ALLOWED_HOSTS = Set.of("files.partner.example", "hooks.partner.example");
    @Override
    public InetAddress[] resolve(String host) throws UnknownHostException {
        if (!ALLOWED_HOSTS.contains(host)) throw new UnknownHostException("host not allowed: " + host);
        InetAddress[] addrs = super.resolve(host);
        for (InetAddress a : addrs) {
            boolean ula = a instanceof Inet6Address && (a.getAddress()[0] & 0xfe) == 0xfc; // fc00::/7
            if (ula || a.isLoopbackAddress() || a.isSiteLocalAddress() || a.isLinkLocalAddress()
                    || a.isAnyLocalAddress() || a.isMulticastAddress()) {
                throw new UnknownHostException("address not allowed: " + host);
            }
        }
        return addrs;
    }
}

RestClient partner = RestClient.builder().requestFactory(new HttpComponentsClientHttpRequestFactory(HttpClients.custom()
        .setConnectionManager(PoolingHttpClientConnectionManagerBuilder.create().setDnsResolver(new PublicOnlyDnsResolver()).build())
        .setDefaultRequestConfig(RequestConfig.custom().setResponseTimeout(Timeout.ofSeconds(5)).build())
        .disableRedirectHandling().build())).build();

byte[] fetchPartnerFile(String url) {
    URI uri = URI.create(url);
    if (!"https".equals(uri.getScheme())) throw new IllegalArgumentException("url_not_allowed");
    byte[] body = partner.get().uri(uri).exchange((req, res) -> res.getBody().readNBytes(1_048_577));
    if (body.length > 1_048_576) throw new IllegalStateException("response_too_large"); // 1 MB cap
    return body;
}
`
    }
  }),
  "path-guard": family({
    express: {
      code: `
import express from 'express';
import path from 'node:path';
import { realpath } from 'node:fs/promises';

// Resolved once at startup, with symlinks followed.
const BASE_DIR = await realpath('/srv/app/invoices');

// Resolve the requested name against the base and refuse anything that lands
// outside it: ../ sequences, absolute paths and symlinks pointing elsewhere.
async function resolveInside(base, name) {
  const real = await realpath(path.resolve(base, name)); // throws if the file is missing
  if (!real.startsWith(base + path.sep)) throw new Error('path_outside_base');
  return real;
}

export const router = express.Router();

router.get('/invoices/files/:name', async (req, res) => {
  let file;
  try {
    file = await resolveInside(path.join(BASE_DIR, String(req.user.id)), req.params.name);
  } catch {
    return res.status(404).json({ error: 'not_found' });
  }
  return res.sendFile(file, { dotfiles: 'deny' });
});
`
    },
    fastapi: {
      code: `
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from .deps import current_user

BASE_DIR = Path("/srv/app/invoices").resolve()
router = APIRouter()


def resolve_inside(base: Path, name: str) -> Path:
    # resolve() collapses ../ and follows symlinks; the result must stay under base.
    target = (base / name).resolve()
    if not target.is_relative_to(base) or not target.is_file():
        raise HTTPException(status_code=404, detail="not_found")
    return target


@router.get("/invoices/files/{name}")
def download_invoice(name: str, user=Depends(current_user)):
    path = resolve_inside(BASE_DIR / str(user.id), name)
    return FileResponse(path, media_type="application/pdf")
`
    },
    django: {
      code: `
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

BASE_DIR = Path(settings.INVOICE_ROOT).resolve()


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def download_invoice(request, name: str):
    user_dir = BASE_DIR / str(request.user.pk)
    # resolve() collapses ../ and follows symlinks; anything outside user_dir is refused.
    target = (user_dir / name).resolve()
    if not target.is_relative_to(user_dir) or not target.is_file():
        raise Http404
    return FileResponse(target.open("rb"), content_type="application/pdf", as_attachment=True, filename=target.name)
`
    },
    laravel: {
      code: `
<?php
// app/Http/Controllers/InvoiceFileController.php

public function download(Request $request, string $name)
{
    $base = realpath(storage_path('app/invoices/'.$request->user()->id));
    // realpath() collapses ../ and follows symlinks; the result must stay inside $base.
    $target = $base === false ? false : realpath($base.DIRECTORY_SEPARATOR.$name);

    if ($target === false || ! str_starts_with($target, $base.DIRECTORY_SEPARATOR) || ! is_file($target)) {
        abort(404);
    }

    return response()->download($target, basename($target), ['Content-Type' => 'application/pdf']);
}
`
    },
    spring: {
      code: `
private final Path baseDir = Path.of("/srv/app/invoices").toAbsolutePath().normalize();

@GetMapping("/invoices/files/{name}")
ResponseEntity<Resource> download(@PathVariable String name, @AuthenticationPrincipal Jwt jwt) throws IOException {
    Path userDir = baseDir.resolve(jwt.getSubject()).normalize();
    // normalize() collapses ../ and startsWith() compares whole path segments;
    // toRealPath() then follows symlinks and the check runs again on the real location.
    Path target = userDir.resolve(name).normalize();
    if (!target.startsWith(userDir) || !Files.isRegularFile(target)
            || !target.toRealPath().startsWith(userDir.toRealPath())) {
        throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }
    return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_PDF)
            .header(HttpHeaders.CONTENT_DISPOSITION,
                    ContentDisposition.attachment().filename(target.getFileName().toString()).build().toString())
            .body(new FileSystemResource(target));
}
`
    }
  }),
  // ---------- API8: security misconfiguration ----------
  "error-handler": family({
    express: {
      note: "npm install pino; also run with NODE_ENV=production so Express never prints stack traces itself.",
      code: `
import { randomUUID } from 'node:crypto';
import pino from 'pino';

const log = pino();
const CLIENT_ERRORS = { 400: 'bad_request', 401: 'unauthorized', 403: 'forbidden', 404: 'not_found', 413: 'payload_too_large' };

// Register last, after every router: app.use(errorHandler).
// Detail goes to the server log only; the client gets a correlation id.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const id = randomUUID();
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  log.error({ err, id, method: req.method, path: req.path, user: req.user?.id }, 'request failed');
  res.set('X-Request-Id', id);
  if (status < 500) return res.status(status).json({ error: CLIENT_ERRORS[status] ?? 'request_error', id });
  return res.status(500).json({ error: 'internal_error', id });
}
`
    },
    fastapi: {
      code: `
import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

log = logging.getLogger("api")
app = FastAPI(debug=False)


@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception) -> JSONResponse:
    error_id = str(uuid.uuid4())
    # The traceback goes to the server log, tagged with the id; the client only gets the id.
    log.error("unhandled error id=%s %s %s", error_id, request.method, request.url.path, exc_info=exc)
    return JSONResponse({"error": "internal_error", "id": error_id}, status_code=500,
                        headers={"X-Request-Id": error_id})


@app.exception_handler(RequestValidationError)
async def invalid_request(request: Request, exc: RequestValidationError) -> JSONResponse:
    # Field locations and messages only; never echo the submitted values back.
    fields = [{"loc": err["loc"], "msg": err["msg"]} for err in exc.errors()]
    return JSONResponse({"error": "invalid_request", "fields": fields}, status_code=422)
`
    },
    django: {
      note: "DRF's handler covers API views; with DEBUG = False, Django's own 500 page for other views shows no detail either.",
      code: `
# settings.py
DEBUG = False  # the debug page shows settings, stack frames and local variables
REST_FRAMEWORK = {"EXCEPTION_HANDLER": "orders.errors.api_exception_handler"}

# orders/errors.py
import logging
import uuid

from rest_framework.response import Response
from rest_framework.views import exception_handler

log = logging.getLogger("api")


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)  # DRF keeps handling 4xx (validation, 401, 403, 404)
    if response is not None:
        return response
    error_id = str(uuid.uuid4())
    request = context["request"]
    log.error("unhandled error id=%s %s %s", error_id, request.method, request.path, exc_info=exc)
    return Response({"error": "internal_error", "id": error_id}, status=500, headers={"X-Request-Id": error_id})
`
    },
    laravel: {
      note: "Uses Laravel 11 Context, which adds error_id to the log entry Laravel writes for the exception.",
      code: `
<?php
// bootstrap/app.php (Laravel 11+). Keep APP_DEBUG=false in production.

use Illuminate\\Auth\\AuthenticationException;
use Illuminate\\Foundation\\Configuration\\Exceptions;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\Context;
use Illuminate\\Support\\Str;
use Illuminate\\Validation\\ValidationException;
use Symfony\\Component\\HttpKernel\\Exception\\HttpExceptionInterface;

->withExceptions(function (Exceptions $exceptions) {
    // Runs before Laravel logs the exception, so the log entry carries the id.
    $exceptions->report(function (Throwable $e) {
        Context::add('error_id', (string) Str::uuid());
    });

    $exceptions->render(function (Throwable $e, Request $request) {
        if (! $request->expectsJson() || $e instanceof HttpExceptionInterface
            || $e instanceof ValidationException || $e instanceof AuthenticationException) {
            return null; // expected 4xx responses keep Laravel's own rendering
        }
        $id = Context::get('error_id') ?? (string) Str::uuid();

        return response()->json(['error' => 'internal_error', 'id' => $id], 500, ['X-Request-Id' => $id]);
    });
})
`
    },
    spring: {
      note: "Extending ResponseEntityExceptionHandler keeps Spring MVC's own 4xx answers (bad JSON, validation, 405, 415).",
      code: `
// application.properties: never render stack traces or exception messages.
// server.error.include-stacktrace=never
// server.error.include-message=never

@RestControllerAdvice
class GlobalErrorHandler extends ResponseEntityExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalErrorHandler.class);

    @ExceptionHandler(Exception.class)
    ResponseEntity<Map<String, String>> unhandled(Exception ex, HttpServletRequest req) throws Exception {
        if (ex instanceof AccessDeniedException || ex instanceof AuthenticationException) {
            throw ex; // let Spring Security answer 403 / 401
        }
        String id = UUID.randomUUID().toString();
        // The stack trace goes to the server log, tagged with the id; the client only gets the id.
        log.error("unhandled error id={} {} {}", id, req.getMethod(), req.getRequestURI(), ex);
        return ResponseEntity.internalServerError()
                .header("X-Request-Id", id)
                .body(Map.of("error", "internal_error", "id", id));
    }
}
`
    }
  }),
  "security-headers": family({
    express: {
      note: "npm install helmet (v7 or later); it also removes the X-Powered-By header.",
      code: `
import express from 'express';
import helmet from 'helmet';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // TLS ends at the proxy; req.secure reads X-Forwarded-Proto

// Refuse plain HTTP instead of serving API data over it.
app.use((req, res, next) => (req.secure ? next() : res.status(403).json({ error: 'https_required' })));

app.use(helmet({
  // A JSON API never loads scripts or gets framed.
  contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true },
  xContentTypeOptions: true, // nosniff
  xFrameOptions: { action: 'deny' },
  referrerPolicy: { policy: 'no-referrer' },
}));

// Authenticated responses must not be stored by browsers or shared caches.
app.use((req, res, next) => {
  if (req.get('authorization') || req.get('cookie')) res.set('Cache-Control', 'no-store');
  next();
});
`
    },
    fastapi: {
      note: "Start uvicorn with --no-server-header (and --proxy-headers behind a TLS proxy) so it does not announce itself.",
      code: `
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

# No public docs UI in production; the CSP below would block it anyway.
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

SECURITY_HEADERS = {
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
}


@app.middleware("http")
async def security_headers(request: Request, call_next):
    # Refuse plain HTTP instead of serving API data over it.
    if request.url.scheme != "https":
        return JSONResponse({"error": "https_required"}, status_code=403)
    response = await call_next(request)
    response.headers.update(SECURITY_HEADERS)
    if "authorization" in request.headers or "cookie" in request.headers:
        response.headers["Cache-Control"] = "no-store"  # never cache personal data
    return response
`
    },
    django: {
      note: "Hide the app server banner at the reverse proxy (nginx: proxy_hide_header Server; server_tokens off).",
      code: `
# settings.py
SECURE_SSL_REDIRECT = True  # plain HTTP is redirected to HTTPS
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")  # only behind a proxy that sets it
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "no-referrer"
X_FRAME_OPTIONS = "DENY"
MIDDLEWARE += ["orders.middleware.ApiHeadersMiddleware"]  # SecurityMiddleware stays first

# orders/middleware.py
from django.conf import settings
from django.utils.cache import patch_cache_control


class ApiHeadersMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        if "Authorization" in request.headers or settings.SESSION_COOKIE_NAME in request.COOKIES:
            patch_cache_control(response, no_store=True, private=True)  # never cache personal data
        return response
`
    },
    laravel: {
      note: "Register it in bootstrap/app.php with $middleware->api(append: SecurityHeaders::class), and set expose_php = Off in php.ini.",
      code: `
<?php

namespace App\\Http\\Middleware;

use Closure;
use Illuminate\\Http\\Request;
use Symfony\\Component\\HttpFoundation\\Response;

class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        // Refuse plain HTTP (configure TrustProxies when TLS ends at a proxy).
        abort_unless($request->secure(), 403, 'HTTPS required.');

        $response = $next($request);
        $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', 'no-referrer');
        header_remove('X-Powered-By');
        if ($request->bearerToken() || $request->hasSession()) {
            $response->headers->set('Cache-Control', 'no-store, private'); // never cache personal data
        }

        return $response;
    }
}
`
    },
    spring: {
      note: "Spring Security writes HSTS only on HTTPS requests; terminate TLS in front and close plain HTTP there.",
      code: `
// Inside your @Configuration class.
@Bean
SecurityFilterChain api(HttpSecurity http) throws Exception {
    http
        .headers(h -> h
            .httpStrictTransportSecurity(hsts -> hsts.includeSubDomains(true).maxAgeInSeconds(31536000))
            .contentTypeOptions(Customizer.withDefaults()) // nosniff
            .contentSecurityPolicy(csp -> csp.policyDirectives("default-src 'none'; frame-ancestors 'none'"))
            .frameOptions(frame -> frame.deny())
            .referrerPolicy(ref -> ref.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER))
            .cacheControl(Customizer.withDefaults())) // Cache-Control: no-cache, no-store, max-age=0
        .authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
        .oauth2ResourceServer(oauth -> oauth.jwt(Customizer.withDefaults()));
    return http.build();
}

// application.properties
// server.server-header=                    (no Server banner)
// server.forward-headers-strategy=native   (behind a TLS proxy, so requests count as secure)
`
    }
  }),
  "cors-allowlist": family({
    express: {
      note: "npm install cors; when the origin is not listed, no Access-Control-Allow-Origin header is sent at all.",
      code: `
import cors from 'cors';
import express from 'express';

const app = express();

// Exact origins only: no "*", no regex built from input, never "null".
const ALLOWED_ORIGINS = new Set(['https://app.example.com', 'https://admin.example.com']);

app.use(cors({
  // The Origin header is echoed back only when it is on the list above.
  origin: (origin, callback) => callback(null, origin !== undefined && ALLOWED_ORIGINS.has(origin)),
  credentials: true, // browsers honour this only together with an allowed origin
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
  maxAge: 600,
}));
// cors adds Vary: Origin, so shared caches keep one copy per origin.
`
    },
    fastapi: {
      code: `
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    # Exact origins only: never "*", never "null", no allow_origin_regex built from input.
    allow_origins=["https://app.example.com", "https://admin.example.com"],
    allow_credentials=True,  # only paired with the fixed list above
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
    max_age=600,
)
# With an explicit list, Starlette adds Vary: Origin to every response.
`
    },
    django: {
      note: "pip install django-cors-headers.",
      code: `
# settings.py
INSTALLED_APPS += ["corsheaders"]
MIDDLEWARE.insert(0, "corsheaders.middleware.CorsMiddleware")  # before CommonMiddleware

# Exact origins only. Never CORS_ALLOW_ALL_ORIGINS = True, never "null".
CORS_ALLOWED_ORIGINS = [
    "https://app.example.com",
    "https://admin.example.com",
]
CORS_ALLOW_CREDENTIALS = True  # only applies to the origins above
CORS_ALLOW_METHODS = ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
CORS_ALLOW_HEADERS = ["authorization", "content-type", "idempotency-key"]
CORS_PREFLIGHT_MAX_AGE = 600
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS  # same list for cookie-authenticated writes
`
    },
    laravel: {
      code: `
<?php
// config/cors.php, read by Laravel's built-in HandleCors middleware.

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['GET', 'POST', 'PATCH', 'DELETE'],
    // Exact origins only: never '*', never 'null', no patterns built from input.
    'allowed_origins' => ['https://app.example.com', 'https://admin.example.com'],
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['Authorization', 'Content-Type', 'Idempotency-Key'],
    'exposed_headers' => [],
    'max_age' => 600,
    'supports_credentials' => true, // only meaningful together with the fixed list above
];
`
    },
    spring: {
      code: `
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
class CorsConfig {

    // Picked up by http.cors(Customizer.withDefaults()) in the SecurityFilterChain.
    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cors = new CorsConfiguration();
        // Exact origins only: no "*", no allowedOriginPatterns, never "null".
        cors.setAllowedOrigins(List.of("https://app.example.com", "https://admin.example.com"));
        cors.setAllowCredentials(true); // Spring refuses credentials together with "*"
        cors.setAllowedMethods(List.of("GET", "POST", "PATCH", "DELETE"));
        cors.setAllowedHeaders(List.of("Authorization", "Content-Type", "Idempotency-Key"));
        cors.setMaxAge(600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cors);
        return source; // Spring's CORS processor adds Vary: Origin
    }
}
`
    }
  }),
  "cookie-flags": family({
    express: {
      note: "npm install express-session connect-redis; call req.session.regenerate() after login to prevent session fixation.",
      code: `
import express from 'express';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { redis } from './redis.js';

const app = express();
app.set('trust proxy', 1); // TLS ends at the proxy; needed for Secure cookies

app.use(session({
  name: '__Host-sid', // __Host- prefix: the browser requires Secure, Path=/ and no Domain
  secret: process.env.SESSION_SECRET,
  store: new RedisStore({ client: redis }),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: true,
    httpOnly: true, // not readable from JavaScript
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 60 * 1000, // 30 minutes, renewed while the user is active
  },
}));
`
    },
    fastapi: {
      code: `
from fastapi import APIRouter, Response

from .schemas import LoginIn
from .services import auth, sessions

router = APIRouter()
SESSION_MAX_AGE = 30 * 60  # 30 minutes


@router.post("/auth/login", status_code=204)
async def login(body: LoginIn, response: Response):
    user = await auth.authenticate(body.email, body.password)  # raises 401 on failure
    session_id = await sessions.create(user.id, ttl=SESSION_MAX_AGE)  # random, stored server-side
    response.set_cookie(
        key="__Host-sid",  # __Host- prefix: the browser requires Secure, Path=/ and no Domain
        value=session_id,
        max_age=SESSION_MAX_AGE,
        path="/",
        secure=True,
        httponly=True,  # not readable from JavaScript
        samesite="lax",
    )
`
    },
    django: {
      code: `
# settings.py
SESSION_COOKIE_NAME = "__Host-sessionid"  # __Host- prefix: the browser requires Secure, Path=/ and no Domain
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True  # not readable from JavaScript
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_PATH = "/"
SESSION_COOKIE_DOMAIN = None
SESSION_COOKIE_AGE = 30 * 60  # 30 minutes
SESSION_SAVE_EVERY_REQUEST = True  # sliding expiry while the user is active

CSRF_COOKIE_SECURE = True
CSRF_COOKIE_SAMESITE = "Lax"

# views.py: django.contrib.auth.login() rotates the session key on sign-in,
# which prevents session fixation. Call it rather than writing session keys yourself.
`
    },
    laravel: {
      code: `
<?php
// config/session.php: the keys that control the session cookie (leave the others as they are).

return [
    'driver' => env('SESSION_DRIVER', 'database'),
    'lifetime' => 30,              // minutes
    'expire_on_close' => false,
    'encrypt' => true,
    'cookie' => '__Host-session',  // __Host- prefix: the browser requires Secure, Path=/ and no Domain
    'path' => '/',
    'domain' => null,
    'secure' => true,
    'http_only' => true,           // not readable from JavaScript
    'same_site' => 'lax',
];

// After a successful login, issue a new session id (prevents session fixation):
// $request->session()->regenerate();
`
    },
    spring: {
      code: `
// application.properties, for the servlet session cookie:
// server.servlet.session.cookie.secure=true
// server.servlet.session.cookie.http-only=true
// server.servlet.session.cookie.same-site=lax
// server.servlet.session.cookie.path=/
// server.servlet.session.timeout=30m

// A cookie you set yourself, for example after login:
@PostMapping("/auth/login")
ResponseEntity<Void> login(@Valid @RequestBody LoginRequest body) {
    String sessionId = sessions.create(auth.authenticate(body), Duration.ofMinutes(30)); // random, server-side
    ResponseCookie cookie = ResponseCookie.from("__Host-sid", sessionId) // __Host-: Secure, Path=/, no Domain
            .secure(true)
            .httpOnly(true) // not readable from JavaScript
            .sameSite("Lax")
            .path("/")
            .maxAge(Duration.ofMinutes(30))
            .build();
    return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookie.toString()).build();
}
`
    }
  }),
  "jwt-verify": family({
    express: {
      note: "npm install jose; jwtVerify only ever uses the key set you pass, so jku and x5u headers in a token are ignored.",
      code: `
import { createRemoteJWKSet, jwtVerify } from 'jose';

const ISSUER = 'https://auth.example.com/';
const AUDIENCE = 'https://api.example.com';
// Keys come only from the known issuer's JWKS; kid is just a lookup key into it.
const JWKS = createRemoteJWKSet(new URL('https://auth.example.com/.well-known/jwks.json'));

export async function authenticate(req, res, next) {
  const header = req.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthorized' });
  try {
    const { payload } = await jwtVerify(header.slice(7), JWKS, {
      algorithms: ['RS256'], // pinned: "none" and HS256/RS256 confusion are rejected
      issuer: ISSUER,
      audience: AUDIENCE,
      requiredClaims: ['exp', 'iat', 'sub'],
      maxTokenAge: '1h', // refuse long-lived tokens even if exp is far away
      clockTolerance: 30,
    });
    req.user = { id: payload.sub, scope: payload.scope };
    return next();
  } catch {
    return res.set('WWW-Authenticate', 'Bearer error="invalid_token"').status(401).json({ error: 'unauthorized' });
  }
}
`
    },
    fastapi: {
      note: "pip install 'pyjwt[crypto]'; PyJWT never follows jku, x5u or jwk headers on its own.",
      code: `
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

ISSUER = "https://auth.example.com/"
AUDIENCE = "https://api.example.com"
# Keys come only from the known issuer's JWKS; kid is just a lookup key into it.
jwks = jwt.PyJWKClient("https://auth.example.com/.well-known/jwks.json", cache_keys=True)
bearer = HTTPBearer()


def current_claims(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    try:
        key = jwks.get_signing_key_from_jwt(creds.credentials).key
        return jwt.decode(
            creds.credentials,
            key,
            algorithms=["RS256"],  # pinned: "none" and HS256/RS256 confusion are rejected
            issuer=ISSUER,
            audience=AUDIENCE,
            leeway=30,
            options={"require": ["exp", "iat", "iss", "aud", "sub"]},
        )
    except jwt.PyJWTError:
        raise HTTPException(401, "invalid_token", headers={"WWW-Authenticate": "Bearer"})
`
    },
    django: {
      note: "pip install 'pyjwt[crypto]'; djangorestframework-simplejwt can do the same with its ALGORITHM, ISSUER, AUDIENCE and JWK_URL settings.",
      code: `
import jwt
from django.contrib.auth import get_user_model
from rest_framework import authentication, exceptions

ISSUER = "https://auth.example.com/"
AUDIENCE = "https://api.example.com"
jwks = jwt.PyJWKClient("https://auth.example.com/.well-known/jwks.json", cache_keys=True)


class IssuerJWTAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return None
        token = header.removeprefix("Bearer ")
        try:
            # kid is only a lookup key into the issuer's JWKS; jku, x5u and jwk headers are ignored.
            key = jwks.get_signing_key_from_jwt(token).key
            claims = jwt.decode(token, key, algorithms=["RS256"], issuer=ISSUER, audience=AUDIENCE,
                                leeway=30, options={"require": ["exp", "iat", "iss", "aud", "sub"]})
        except jwt.PyJWTError:
            raise exceptions.AuthenticationFailed("invalid_token")
        user = get_user_model().objects.filter(external_id=claims["sub"], is_active=True).first()
        if user is None:
            raise exceptions.AuthenticationFailed("invalid_token")
        return user, claims

    def authenticate_header(self, request):
        return 'Bearer realm="api"'
`
    },
    laravel: {
      note: "composer require firebase/php-jwt; the provider also needs use lines for Auth, Cache, Http, Request, User, JWT and JWK.",
      code: `
<?php
// app/Providers/AppServiceProvider.php, inside boot(). In config/auth.php add
// 'guards' => ['api' => ['driver' => 'issuer-jwt']], then protect routes with auth:api.

Auth::viaRequest('issuer-jwt', function (Request $request) {
    $token = $request->bearerToken();
    if (! $token) {
        return null;
    }
    // Keys come only from the known issuer's JWKS; jku, x5u and jwk headers are never used.
    $jwks = Cache::remember('issuer-jwks', 3600, fn () => Http::timeout(5)
        ->get('https://auth.example.com/.well-known/jwks.json')->throw()->json());
    // Pin RS256: drop any key that declares another algorithm.
    $jwks['keys'] = array_values(array_filter($jwks['keys'], fn ($k) => ($k['alg'] ?? 'RS256') === 'RS256'));
    try {
        JWT::$leeway = 30;
        $claims = JWT::decode($token, JWK::parseKeySet($jwks, 'RS256')); // signature, exp, nbf, iat
    } catch (\\Throwable) {
        return null;
    }
    // php-jwt does not require exp or check iss and aud, so do it here.
    if (! isset($claims->exp, $claims->sub) || ($claims->iss ?? null) !== 'https://auth.example.com/'
        || ! in_array('https://api.example.com', (array) ($claims->aud ?? []), true)) {
        return null;
    }

    return User::where('external_id', $claims->sub)->first();
});
`
    },
    spring: {
      note: "Spring Security picks this JwtDecoder bean up for oauth2ResourceServer(oauth -> oauth.jwt(...)).",
      code: `
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import org.springframework.context.annotation.Bean;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.*;

@Bean
JwtDecoder jwtDecoder() {
    // Keys come only from the known issuer's JWKS; jku, x5u and jwk headers are never used.
    NimbusJwtDecoder decoder = NimbusJwtDecoder
            .withJwkSetUri("https://auth.example.com/.well-known/jwks.json")
            .jwsAlgorithm(SignatureAlgorithm.RS256) // pinned: "none" and HS256/RS256 confusion are rejected
            .build();
    decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
            JwtValidators.createDefaultWithIssuer("https://auth.example.com/"), // iss, exp, nbf (60 s skew)
            new JwtClaimValidator<Instant>(JwtClaimNames.EXP, Objects::nonNull), // exp is required
            new JwtClaimValidator<List<String>>(JwtClaimNames.AUD,
                    aud -> aud != null && aud.contains("https://api.example.com"))));
    return decoder;
}
`
    }
  }),
  // ---------- AI agents and LLM features ----------
  "agent-approval": family({
    express: {
      note: "The agent token must not be able to call the confirm route; approval has to come from the person, on a separate credential.",
      code: `
import express from 'express';
import { requireHumanSession, requireScope } from './auth.js';
import { IssueRefundArgs, orders, pendingActions, refunds } from './domain.js';

const MAX_OPEN_ACTIONS = 5; // per user
export const router = express.Router();

// Agent tool "issue_refund": records a pending action and returns it. No money moves here.
router.post('/agent/tools/issue_refund', requireScope('agent:tools'), async (req, res) => {
  const { success, data: args } = IssueRefundArgs.safeParse(req.body); // strict zod schema
  if (!success) return res.status(422).json({ error: 'invalid_arguments' });
  const order = await orders.findOwned(args.order_id, req.user.id);
  if (!order) return res.status(404).json({ error: 'not_found' });
  if (args.amount_cents > order.refundable_cents) return res.status(422).json({ error: 'amount_too_high' });
  if ((await pendingActions.countOpen(req.user.id)) >= MAX_OPEN_ACTIONS) {
    return res.status(429).json({ error: 'too_many_pending_actions' });
  }
  const action = await pendingActions.create({
    userId: req.user.id, type: 'issue_refund', params: args, expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });
  return res.status(202).json({ status: 'pending_approval', action_id: action.id });
});

// Confirmed by the signed-in person in the app (session + CSRF); the agent's token is not accepted.
router.post('/actions/:id/confirm', requireHumanSession, async (req, res) => {
  const action = await pendingActions.claimOpen(req.params.id, req.user.id); // atomic: open -> confirmed, unexpired
  if (!action) return res.status(404).json({ error: 'not_found' });
  const refund = await refunds.issue(action.params, { userId: req.user.id, approvedActionId: action.id });
  return res.status(201).json({ refund_id: refund.id });
});
`
    },
    fastapi: {
      note: "claim_open() should flip status from open to confirmed in one UPDATE ... WHERE status = open AND expires_at > now().",
      code: `
from fastapi import APIRouter, Depends, HTTPException, Security

from .auth import current_app_session, require_scopes
from .domain import IssueRefundArgs, orders, pending_actions, refunds

router = APIRouter()


@router.post("/agent/tools/issue_refund", status_code=202)
def agent_issue_refund(args: IssueRefundArgs, user=Security(require_scopes, scopes=["agent:tools"])):
    # The agent's call only records a pending action; no money moves here.
    order = orders.get_owned(args.order_id, user.id)
    if order is None:
        raise HTTPException(404, "not_found")
    if args.amount_cents > order.refundable_cents:
        raise HTTPException(422, "amount_too_high")
    if pending_actions.count_open(user.id) >= 5:  # per-user cap on open actions
        raise HTTPException(429, "too_many_pending_actions")
    action = pending_actions.create(user.id, "issue_refund", args.model_dump(), ttl_minutes=15)
    return {"status": "pending_approval", "action_id": action.id}


@router.post("/actions/{action_id}/confirm", status_code=201)
def confirm_action(action_id: int, user=Depends(current_app_session)):
    # Browser session with a CSRF check only: the agent's bearer token cannot confirm.
    action = pending_actions.claim_open(action_id, user.id)  # atomic: open -> confirmed, unexpired
    if action is None:
        raise HTTPException(404, "not_found")
    refund = refunds.issue(**action.params, user_id=user.id, approved_action_id=action.id)
    return {"refund_id": refund.id}
`
    },
    django: {
      note: "Standard Django and DRF imports (APIView, Response, get_object_or_404, transaction, timezone, timedelta) are omitted for length.",
      code: `
class AgentIssueRefundView(APIView):
    """Agent tool endpoint: records a pending action and returns it. No money moves here."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        args = IssueRefundArgsSerializer(data=request.data)
        args.is_valid(raise_exception=True)
        order = get_object_or_404(Order, pk=args.validated_data["order_id"], owner=request.user)
        if args.validated_data["amount_cents"] > order.refundable_cents:
            return Response({"error": "amount_too_high"}, status=422)
        if PendingAction.objects.filter(user=request.user, status="open").count() >= 5:  # per-user cap
            return Response({"error": "too_many_pending_actions"}, status=429)
        action = PendingAction.objects.create(user=request.user, kind="issue_refund", params=args.validated_data,
                                              status="open", expires_at=timezone.now() + timedelta(minutes=15))
        return Response({"status": "pending_approval", "action_id": action.pk}, status=202)


class ConfirmActionView(APIView):
    authentication_classes = [SessionAuthentication]  # browser session + CSRF; agent tokens are refused
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        with transaction.atomic():
            action = get_object_or_404(PendingAction.objects.select_for_update(), pk=pk, user=request.user,
                                       status="open", expires_at__gt=timezone.now())
            action.status = "confirmed"
            action.save(update_fields=["status"])
            refund = issue_refund(user=request.user, approved_action=action, **action.params)
        return Response({"refund_id": refund.pk}, status=201)
`
    },
    laravel: {
      note: "Put the agent route behind auth:sanctum with an agent ability, and the confirm route behind the web guard only.",
      code: `
<?php
// Agent tool "issue_refund": records a pending action and returns it. No money moves here.
public function issueRefund(Request $request)
{
    $args = $request->validate([
        'order_id' => ['required', 'integer'],
        'amount_cents' => ['required', 'integer', 'min:1'],
    ]);
    $order = $request->user()->orders()->findOrFail($args['order_id']);
    abort_if($args['amount_cents'] > $order->refundable_cents, 422, 'Amount exceeds the refundable total.');
    abort_if($request->user()->pendingActions()->where('status', 'open')->count() >= 5, 429, 'Too many pending actions.');

    $action = $request->user()->pendingActions()->create([
        'kind' => 'issue_refund', 'params' => $args, 'status' => 'open', 'expires_at' => now()->addMinutes(15),
    ]);
    return response()->json(['status' => 'pending_approval', 'action_id' => $action->id], 202);
}

// Confirmed by the signed-in person in the web app (web guard + CSRF); agent tokens are not accepted.
public function confirm(Request $request, int $id)
{
    $refund = DB::transaction(function () use ($request, $id) {
        $action = $request->user()->pendingActions()->whereKey($id)->where('status', 'open')
            ->where('expires_at', '>', now())->lockForUpdate()->firstOrFail();
        $action->forceFill(['status' => 'confirmed'])->save();
        return $this->refunds->issue($request->user(), $action->params, approvedAction: $action);
    });

    return response()->json(['refund_id' => $refund->id], 201);
}
`
    },
    spring: {
      note: "findOpenForUpdate is a repository query with @Lock(PESSIMISTIC_WRITE) that matches status open and an unexpired action.",
      code: `
// Agent tool "issue_refund": records a pending action and returns it. No money moves here.
@PostMapping("/agent/tools/issue_refund")
@PreAuthorize("hasAuthority('SCOPE_agent:tools')")
ResponseEntity<Map<String, Object>> agentIssueRefund(@Valid @RequestBody IssueRefundArgs args,
                                                     @AuthenticationPrincipal Jwt jwt) {
    String userId = jwt.getSubject();
    Order order = orders.findByIdAndOwnerId(args.orderId(), userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    if (args.amountCents() > order.getRefundableCents()) {
        throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "amount_too_high");
    }
    if (pendingActions.countByUserIdAndStatus(userId, "open") >= 5) { // per-user cap on open actions
        throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "too_many_pending_actions");
    }
    PendingAction action = pendingActions.save(
            PendingAction.open(userId, "issue_refund", args, Instant.now().plus(Duration.ofMinutes(15))));
    return ResponseEntity.accepted().body(Map.of("status", "pending_approval", "actionId", action.getId()));
}

// Lives on the session-based /app filter chain (form login + CSRF); agent bearer tokens are not accepted there.
@PostMapping("/app/actions/{id}/confirm")
@Transactional
ResponseEntity<Map<String, Object>> confirm(@PathVariable long id, Principal principal) {
    PendingAction action = pendingActions.findOpenForUpdate(id, principal.getName(), Instant.now())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    action.markConfirmed();
    Refund refund = refunds.issue(action.getParams(IssueRefundArgs.class), principal.getName(), action.getId());
    return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("refundId", refund.getId()));
}
`
    }
  }),
  "prompt-guard": family({
    express: {
      note: "Shown with the Anthropic SDK (npm install @anthropic-ai/sdk); the same four controls apply to any model provider.",
      code: `
import Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import { requireAuth } from './auth.js';
import { assistantLimiter } from './limits.js';

const anthropic = new Anthropic(); // the API key stays on the server (ANTHROPIC_API_KEY)
const MAX_INPUT_CHARS = 4000;
// The system prompt lives here; the client cannot send, read or override it.
const SYSTEM_PROMPT = 'You answer questions about the signed-in customer orders and invoices.';
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:[.][A-Za-z0-9-]+)+/g;
const CARD = /(?<![0-9])[0-9](?:[ -]?[0-9]){12,18}(?![0-9])/g;

export const router = express.Router();

router.post('/assistant', requireAuth, assistantLimiter, async (req, res) => {
  const text = req.body?.message;
  if (typeof text !== 'string' || text.length === 0 || text.length > MAX_INPUT_CHARS) {
    return res.status(422).json({ error: 'message_must_be_1_to_4000_chars' });
  }
  // Only the user's text is forwarded; body.system, body.model and body.max_tokens are ignored.
  const reply = await anthropic.messages.create({
    model: 'claude-opus-5-5', // chosen on the server
    max_tokens: 2048, // hard cap on output cost
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: text.replace(EMAIL, '[email]').replace(CARD, '[card]') }],
  });
  const answer = reply.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  return res.json({ answer });
});
`
    },
    fastapi: {
      note: "Shown with the Anthropic SDK (pip install anthropic); the same four controls apply to any model provider.",
      code: `
import re

from anthropic import AsyncAnthropic
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from .deps import current_user

client = AsyncAnthropic()  # the API key stays on the server (ANTHROPIC_API_KEY)
SYSTEM_PROMPT = "You answer questions about the signed-in customer's orders and invoices."  # server-side only
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:[.][A-Za-z0-9-]+)+")
CARD = re.compile(r"(?<![0-9])[0-9](?:[ -]?[0-9]){12,18}(?![0-9])")
router = APIRouter()


class AssistantIn(BaseModel):
    model_config = ConfigDict(extra="forbid")  # system, model or max_tokens from the client: 422
    message: str = Field(min_length=1, max_length=4000)


@router.post("/assistant", dependencies=[Depends(current_user)])
async def assistant(body: AssistantIn):
    redacted = CARD.sub("[card]", EMAIL.sub("[email]", body.message))
    reply = await client.messages.create(
        model="claude-opus-5-5",  # chosen on the server
        max_tokens=2048,  # hard cap on output cost
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": redacted}],
    )
    return {"answer": "".join(b.text for b in reply.content if b.type == "text")}
`
    },
    django: {
      note: "Shown with the Anthropic SDK (pip install anthropic); keep the default IsAuthenticated permission and add a throttle scope.",
      code: `
import re

import anthropic
from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.response import Response

client = anthropic.Anthropic()  # the API key stays on the server (ANTHROPIC_API_KEY)
SYSTEM_PROMPT = "You answer questions about the signed-in customer's orders and invoices."  # server-side only
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:[.][A-Za-z0-9-]+)+")
CARD = re.compile(r"(?<![0-9])[0-9](?:[ -]?[0-9]){12,18}(?![0-9])")


class AssistantSerializer(serializers.Serializer):
    message = serializers.CharField(min_length=1, max_length=4000)  # the only field read


@api_view(["POST"])
def assistant(request):
    data = AssistantSerializer(data=request.data)
    data.is_valid(raise_exception=True)
    redacted = CARD.sub("[card]", EMAIL.sub("[email]", data.validated_data["message"]))
    # system, model and max_tokens are fixed here; anything else in the request is ignored.
    reply = client.messages.create(
        model="claude-opus-5-5",
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": redacted}],
    )
    return Response({"answer": "".join(b.text for b in reply.content if b.type == "text")})
`
    },
    laravel: {
      note: "Shown with the Anthropic PHP SDK (composer require anthropic-ai/sdk); bind its Client as a singleton in a service provider.",
      code: `
<?php
// app/Http/Controllers/AssistantController.php

use Anthropic\\Client;
use Illuminate\\Http\\Request;

public function ask(Request $request, Client $anthropic)
{
    // Only "message" is read; system, model and max_tokens from the client are ignored.
    $message = $request->validate(['message' => ['required', 'string', 'max:4000']])['message'];

    // Redact obvious PII before it leaves your infrastructure.
    $redacted = preg_replace(
        ['/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:[.][A-Za-z0-9-]+)+/', '/(?<![0-9])[0-9](?:[ -]?[0-9]){12,18}(?![0-9])/'],
        ['[email]', '[card]'],
        $message,
    );

    $reply = $anthropic->messages->create(
        model: 'claude-opus-5-5',                   // chosen on the server
        maxTokens: 2048,                            // hard cap on output cost
        system: config('assistant.system_prompt'),  // stored server-side, never sent by the client
        messages: [['role' => 'user', 'content' => $redacted]],
    );

    $answer = collect($reply->content)->where('type', 'text')->pluck('text')->implode('');
    return response()->json(['answer' => $answer]);
}
`
    },
    spring: {
      note: "Shown with the Anthropic Java SDK (com.anthropic:anthropic-java); imports are omitted for length.",
      code: `
private static final Pattern EMAIL = Pattern.compile("[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:[.][A-Za-z0-9-]+)+");
private static final Pattern CARD = Pattern.compile("(?<![0-9])[0-9](?:[ -]?[0-9]){12,18}(?![0-9])");
// The system prompt lives on the server; the client cannot send, read or override it.
private static final String SYSTEM_PROMPT = "You answer questions about the signed-in customer's orders and invoices.";
private final AnthropicClient anthropic = AnthropicOkHttpClient.fromEnv(); // the API key stays on the server

record AssistantRequest(@NotBlank @Size(max = 4000) String message) {} // the only field accepted

@PostMapping("/assistant")
Map<String, String> ask(@Valid @RequestBody AssistantRequest body) {
    String redacted = CARD.matcher(EMAIL.matcher(body.message()).replaceAll("[email]")).replaceAll("[card]");
    MessageCreateParams params = MessageCreateParams.builder()
            .model("claude-opus-5-5") // chosen on the server
            .maxTokens(2048L)         // hard cap on output cost
            .system(SYSTEM_PROMPT)
            .addUserMessage(redacted)
            .build();
    Message reply = anthropic.messages().create(params);
    String answer = reply.content().stream()
            .flatMap(block -> block.text().stream())
            .map(TextBlock::text)
            .collect(Collectors.joining());
    return Map.of("answer", answer);
}
`
    }
  }),
  "output-encoding": family({
    express: {
      note: "npm install marked sanitize-html; in the browser, DOMPurify with the same rules does the same job.",
      code: `
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const LINK_HOSTS = new Set(['example.com', 'docs.example.com']);

// Plain-text display: escape everything the model wrote.
export const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function isAllowedLink(href) {
  try {
    const url = new URL(href);
    return url.protocol === 'https:' && LINK_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

// Markdown display: model output is untrusted. No images (they can leak data
// through their URL), and links survive only for allow-listed https hosts.
export function renderModelMarkdown(markdown) {
  return sanitizeHtml(marked.parse(markdown, { async: false }), {
    allowedTags: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote', 'a'],
    allowedAttributes: { a: ['href', 'rel'] },
    allowedSchemes: ['https'],
    exclusiveFilter: (frame) => frame.tag === 'a' && !isAllowedLink(frame.attribs.href ?? ''),
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow' }) },
  });
}
`
    },
    fastapi: {
      note: "pip install nh3 markdown-it-py; return the cleaned HTML and never re-insert the raw model text.",
      code: `
import html
from urllib.parse import urlsplit

import nh3
from markdown_it import MarkdownIt

LINK_HOSTS = {"example.com", "docs.example.com"}
ALLOWED_TAGS = {"p", "br", "strong", "em", "code", "pre", "ul", "ol", "li", "blockquote", "a"}
md = MarkdownIt("commonmark", {"html": False})  # raw HTML in the model output is escaped, not passed on


def render_model_text(text: str) -> str:
    return html.escape(text)  # plain-text display: escape everything the model wrote


def keep_allowed_links(tag: str, attr: str, value: str) -> str | None:
    if tag == "a" and attr == "href":
        url = urlsplit(value)
        return value if url.scheme == "https" and url.hostname in LINK_HOSTS else None
    return value


def render_model_markdown(text: str) -> str:
    # Model output is untrusted: img is not an allowed tag, so images (which can leak data
    # through their URL) are dropped, and links keep their href only for allow-listed hosts.
    return nh3.clean(md.render(text), tags=ALLOWED_TAGS, attributes={"a": {"href"}},
                     attribute_filter=keep_allowed_links, url_schemes={"https"},
                     link_rel="noopener noreferrer nofollow")
`
    },
    django: {
      note: "pip install nh3 markdown-it-py; in templates, {{ answer }} autoescapes, so never add |safe to raw model text.",
      code: `
from urllib.parse import urlsplit

import nh3
from django.utils.html import escape
from django.utils.safestring import mark_safe
from markdown_it import MarkdownIt

LINK_HOSTS = {"example.com", "docs.example.com"}
md = MarkdownIt("commonmark", {"html": False})  # raw HTML in the model output is escaped


def render_model_text(text: str) -> str:
    return escape(text)  # plain-text display: escape everything the model wrote


def keep_allowed_links(tag: str, attr: str, value: str) -> str | None:
    if tag == "a" and attr == "href":
        url = urlsplit(value)
        return value if url.scheme == "https" and url.hostname in LINK_HOSTS else None
    return value


def render_model_markdown(text: str):
    # Model output is untrusted: images are dropped (img is not allowed) and links keep
    # their href only for allow-listed https hosts. mark_safe only after nh3 has cleaned it.
    cleaned = nh3.clean(md.render(text), tags={"p", "br", "strong", "em", "code", "pre", "ul", "ol", "li", "a"},
                        attributes={"a": {"href"}}, attribute_filter=keep_allowed_links,
                        url_schemes={"https"}, link_rel="noopener noreferrer nofollow")
    return mark_safe(cleaned)
`
    },
    laravel: {
      note: "league/commonmark ships with Laravel; for plain text, {{ $answer }} in Blade escapes it, so never use {!! !!} on model output.",
      code: `
<?php

use League\\CommonMark\\Environment\\Environment;
use League\\CommonMark\\Event\\DocumentParsedEvent;
use League\\CommonMark\\Extension\\CommonMark\\CommonMarkCoreExtension;
use League\\CommonMark\\Extension\\CommonMark\\Node\\Inline\\Image;
use League\\CommonMark\\Extension\\CommonMark\\Node\\Inline\\Link;
use League\\CommonMark\\MarkdownConverter;

function renderModelMarkdown(string $markdown, array $linkHosts = ['example.com', 'docs.example.com']): string
{
    // Raw HTML in the model output is escaped; javascript: and data: links are removed.
    $environment = new Environment(['html_input' => 'escape', 'allow_unsafe_links' => false]);
    $environment->addExtension(new CommonMarkCoreExtension());
    $environment->addEventListener(DocumentParsedEvent::class, function (DocumentParsedEvent $event) use ($linkHosts) {
        foreach (iterator_to_array($event->getDocument()->iterator(), false) as $node) {
            if ($node instanceof Image) {
                $node->detach(); // images can leak data through their URL
            } elseif ($node instanceof Link && (! str_starts_with($node->getUrl(), 'https://')
                || ! in_array(parse_url($node->getUrl(), PHP_URL_HOST), $linkHosts, true))) {
                foreach ($node->children() as $child) {
                    $node->insertBefore($child); // keep the link text, drop the link
                }
                $node->detach();
            }
        }
    });

    return (string) (new MarkdownConverter($environment))->convert($markdown);
}
`
    },
    spring: {
      note: "Uses org.commonmark:commonmark; imports are omitted for length.",
      code: `
private static final Set<String> LINK_HOSTS = Set.of("example.com", "docs.example.com");
private final Parser parser = Parser.builder().build();
// escapeHtml: raw HTML in the model output is escaped; sanitizeUrls: javascript: URLs are neutralised.
private final HtmlRenderer renderer = HtmlRenderer.builder().escapeHtml(true).sanitizeUrls(true).build();

// Plain-text display: HtmlUtils.htmlEscape(answer), or th:text in Thymeleaf (never th:utext).
String renderModelMarkdown(String markdown) {
    Node document = parser.parse(markdown);
    List<Node> drop = new ArrayList<>();
    document.accept(new AbstractVisitor() {
        @Override
        public void visit(Image image) { drop.add(image); } // images can leak data through their URL
        @Override
        public void visit(Link link) {
            if (!isAllowedLink(link.getDestination())) drop.add(link);
            visitChildren(link);
        }
    });
    drop.forEach(Node::unlink);
    return renderer.render(document);
}

private static boolean isAllowedLink(String href) {
    try {
        URI uri = new URI(href);
        return "https".equals(uri.getScheme()) && LINK_HOSTS.contains(uri.getHost());
    } catch (URISyntaxException e) {
        return false;
    }
}
`
    }
  })
};
var RULES_BY_FIX = {
  ownership: ["API1-OWNERSHIP", "TOOL-ID-PARAM"],
  "require-auth": ["API2-PUBLIC-OP", "API2-NO-SCHEME", "API2-KEY-IN-QUERY", "API2-STATIC-KEY", "REL-NEW-PUBLIC", "REL-AUTH-REMOVED"],
  "require-scope": ["API2-BROAD-SCOPE", "API5-ADMIN-PATH", "REL-SCOPE-REDUCED", "JWT-BROAD-SCOPE", "AGENT-SCOPES"],
  "response-allowlist": ["API3-SENSITIVE-OUT", "REL-NEW-SENSITIVE"],
  "input-allowlist": ["API3-MASS-ASSIGNMENT", "API3-OPEN-BODY", "TOOL-SCHEMA-OPEN", "REL-BODY-OPENED"],
  "page-limit": ["API4-NO-PAGING", "API4-NO-MAX"],
  "upload-limit": ["API4-UPLOAD"],
  "rate-limit": ["API2-LOGIN-RATE", "API4-NO-429", "HDR-NO-RATELIMIT", "LLM-COST-LIMIT", "REL-LIMIT-REMOVED", "AGENT-LIMITS"],
  idempotency: ["API6-BUSINESS-FLOW"],
  "ssrf-guard": ["API7-URL-INPUT", "TOOL-URL-PARAM", "AGENT-EGRESS"],
  "path-guard": ["TOOL-PATH-PARAM"],
  "error-handler": ["API8-ERROR-DETAIL", "ERR-STACK"],
  "security-headers": [
    "API8-PLAIN-HTTP",
    "HDR-NO-HSTS",
    "HDR-SHORT-HSTS",
    "HDR-NO-NOSNIFF",
    "HDR-NO-CSP",
    "HDR-WEAK-CSP",
    "HDR-NO-FRAME",
    "HDR-VERSION-LEAK",
    "HDR-CACHEABLE"
  ],
  "cors-allowlist": ["CORS-WILDCARD-CREDS", "CORS-WILDCARD", "CORS-NULL", "CORS-REFLECTED", "CORS-NO-VARY", "CORS-METHODS"],
  "cookie-flags": ["COOKIE-FLAGS", "COOKIE-SAMESITE-NONE"],
  "jwt-verify": [
    "JWT-NO-SIGNATURE",
    "JWT-SHARED-SECRET",
    "JWT-KEY-IN-HEADER",
    "JWT-ODD-KID",
    "JWT-NO-EXP",
    "JWT-LONG-LIFE",
    "JWT-NO-AUD",
    "JWT-NO-ISS",
    "JWT-SENSITIVE-CLAIMS"
  ],
  "agent-approval": ["TOOL-NEEDS-APPROVAL", "TOOL-NO-ANNOTATIONS", "AGENT-APPROVAL"],
  "prompt-guard": ["LLM-INPUT-LIMIT", "LLM-CLIENT-INSTRUCTIONS", "LLM-PII-IN", "LLM-MODEL-CHOICE"],
  "output-encoding": ["LLM-RAW-OUTPUT"]
};
var FIX_BY_RULE = /* @__PURE__ */ new Map();
for (const key of Object.keys(RULES_BY_FIX)) {
  for (const rule of RULES_BY_FIX[key]) FIX_BY_RULE.set(rule, key);
}
function fixKeyForRule(rule) {
  return FIX_BY_RULE.get(rule) ?? null;
}
function fixFor(rule, framework) {
  const key = fixKeyForRule(rule);
  return key ? FIXES[key][framework] : null;
}

// src/engine/meta.ts
var SITE_URL = "https://patchlane.pages.dev";
var REPO = "abuhuraira99/patchlane";
var REPO_URL = `https://github.com/${REPO}`;
var ACTION_REF = `${REPO}@v1`;

// src/engine/exports.ts
var SEV_LABEL = { critical: "Critical", high: "High", medium: "Medium", low: "Low", info: "Info" };
function fnv1a(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
var esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function locateInSpec(specText, where) {
  if (!specText) return 1;
  const lines = specText.split(/\r?\n/);
  const find = (re, from = 0) => {
    for (let i = from; i < lines.length; i++) if (re.test(lines[i])) return i;
    return -1;
  };
  const op = where.match(/^(GET|PUT|POST|DELETE|PATCH|HEAD|OPTIONS|TRACE) (\S+)/);
  if (op) {
    const p = find(new RegExp(`^\\s*["']?${esc(op[2])}["']?\\s*:`));
    if (p >= 0) {
      const m = find(new RegExp(`^\\s*["']?${op[1].toLowerCase()}["']?\\s*:`), p + 1);
      return (m >= 0 ? m : p) + 1;
    }
  }
  const server = where.match(/^server (\S+)/);
  if (server) {
    const i = find(new RegExp(esc(server[1])));
    if (i >= 0) return i + 1;
  }
  const scheme = where.match(/^scheme (\S+)/);
  if (scheme) {
    const s = find(/securitySchemes|securityDefinitions/);
    const i = find(new RegExp(`^\\s*["']?${esc(scheme[1])}["']?\\s*:`), Math.max(s, 0));
    if (i >= 0) return i + 1;
  }
  const dotted = where.match(/^(info|components)\.(\w+)/);
  if (dotted) {
    const block = find(new RegExp(`^\\s*["']?${dotted[1]}["']?\\s*:`));
    if (block >= 0) {
      const indent = lines[block].match(/^\s*/)?.[0].length ?? 0;
      for (let i = block + 1; i < lines.length; i++) {
        const l = lines[i];
        if (l.trim() && (l.match(/^\s*/)?.[0].length ?? 0) <= indent && !/^\s*[}\]]/.test(l)) break;
        if (new RegExp(`^\\s*["']?${dotted[2]}["']?\\s*:`).test(l)) return i + 1;
      }
      return block + 1;
    }
  }
  return 1;
}
function toJson(report) {
  const { api, ...rest } = report;
  return JSON.stringify({ ...rest, api: api ? { title: api.title, version: api.version, openapi: api.openapi, operations: api.operations.length, servers: api.servers } : null }, null, 2);
}
function toMarkdown(report, framework) {
  const L = [];
  const title = report.api ? `${report.api.title}${report.api.version ? " " + report.api.version : ""}` : "API check-up";
  L.push(`# Patchlane report: ${title}`, "");
  L.push(`Generated ${report.generatedAt.slice(0, 16).replace("T", " ")} UTC by Patchlane ${report.engineVersion}. Checked: ${report.inputs.join(", ") || "nothing"}.`, "");
  L.push(`**Grade ${report.grade.letter}** (${report.grade.score}/100) \xB7 ${report.findings.length} finding${report.findings.length === 1 ? "" : "s"}`, "");
  L.push("| Severity | Count |", "|---|---|");
  for (const s of SEVERITY_ORDER) L.push(`| ${SEV_LABEL[s]} | ${report.bySeverity[s]} |`);
  L.push("");
  if (report.docsScore) {
    L.push(`## Documentation score: ${report.docsScore.score}/100`, "");
    for (const p of report.docsScore.parts) L.push(`- ${p.label}: ${p.value}%`);
    L.push("");
  }
  if (report.release) {
    const r = report.release;
    L.push("## Release check", "");
    L.push(`Version ${r.declared.from} \u2192 ${r.declared.to}. The changes need a **${r.requiredBump}** bump; ${r.bumpOk ? "the version number agrees." : "the version number does not."}`, "");
    if (r.added.length) L.push(`- Added: ${r.added.join(", ")}`);
    if (r.removed.length) L.push(`- Removed: ${r.removed.join(", ")}`);
    for (const c2 of r.changed) L.push(`- Changed: ${c2}`);
    L.push("");
  }
  for (const sev of SEVERITY_ORDER) {
    const list = report.findings.filter((f3) => f3.severity === sev);
    if (!list.length) continue;
    L.push(`## ${SEV_LABEL[sev]} (${list.length})`, "");
    for (const f3 of list) {
      L.push(`### ${f3.title}`, "");
      L.push(`\`${f3.rule}\` \xB7 ${AREA_LABEL[f3.area]} \xB7 **${f3.where}**`, "");
      if (f3.evidence) L.push(`> ${f3.evidence}`, "");
      L.push(f3.detail, "", `**Fix.** ${f3.fix}`, "");
      const refs = f3.refs.map((r) => r.standard).filter(Boolean);
      if (refs.length) L.push(`<sub>${refs.join(" | ")}</sub>`, "");
      if (framework) {
        const fx = fixFor(f3.rule, framework);
        if (fx) L.push(`<details><summary>Fix pattern in ${FRAMEWORK_LABEL[framework]} (adapt the names to ${f3.where})</summary>`, "", "```" + fx.language, fx.code.trim(), "```", fx.note ? `
${fx.note}
` : "", "</details>", "");
      }
    }
  }
  L.push("---", "");
  L.push("A spec, a response or a token shows what an API declares, not everything it does. Treat each finding as something to confirm on the running service, and re-run Patchlane in CI so fixed problems stay fixed.", "");
  L.push(`Made with [Patchlane](${SITE_URL}) \xB7 [source](${REPO_URL})`);
  return L.join("\n");
}
var SARIF_LEVEL = { critical: "error", high: "error", medium: "warning", low: "note", info: "note" };
var SECURITY_SEVERITY = { critical: "9.5", high: "8.0", medium: "5.5", low: "3.0", info: "1.0" };
function fileFor(f3, files = {}) {
  if (f3.area === "server") return files.response ?? "response.txt";
  if (f3.area === "token") return files.token ?? "token.jwt";
  if (f3.area === "agent" && f3.where.startsWith("tool")) return files.tools ?? "tools.json";
  if (f3.area === "agent" && f3.where === "agent safeguards") return files.safeguards ?? "agent-safeguards";
  return files.spec ?? "openapi.yaml";
}
function toSarif(report, opts = {}) {
  const ruleIds = [...new Set(report.findings.map((f3) => f3.rule))];
  const rules = ruleIds.map((id) => {
    const f3 = report.findings.find((x) => x.rule === id);
    const worst = SEVERITY_ORDER.find((s) => report.findings.some((x) => x.rule === id && x.severity === s));
    const standards = f3.refs.map((r) => r.standard).filter(Boolean);
    return {
      id,
      name: id.toLowerCase().replace(/(^|-)([a-z0-9])/g, (_m, _d, c2) => c2.toUpperCase()),
      shortDescription: { text: f3.title },
      fullDescription: { text: f3.detail },
      help: { text: `${f3.fix}${standards.length ? `

${standards.join("; ")}` : ""}`, markdown: `**Fix.** ${f3.fix}${standards.length ? `

${standards.map((s) => `- ${s}`).join("\n")}` : ""}` },
      helpUri: `${SITE_URL}/rules/#${id}`,
      defaultConfiguration: { level: SARIF_LEVEL[worst] },
      properties: { tags: ["security", AREA_LABEL[f3.area].toLowerCase(), ...standards.map((s) => s.split(" ")[0])], "security-severity": SECURITY_SEVERITY[worst], precision: "medium" }
    };
  });
  const results = report.findings.map((f3) => {
    const uri = fileFor(f3, opts.files);
    const line = uri === (opts.files?.spec ?? "openapi.yaml") ? locateInSpec(opts.specText, f3.where) : 1;
    return {
      ruleId: f3.rule,
      ruleIndex: ruleIds.indexOf(f3.rule),
      level: SARIF_LEVEL[f3.severity],
      message: { text: `${f3.title} (${f3.where}). ${f3.detail}${f3.evidence ? ` Evidence: ${f3.evidence}` : ""}` },
      locations: [{ physicalLocation: { artifactLocation: { uri }, region: { startLine: line } } }],
      partialFingerprints: { "patchlane/v1": fnv1a(`${f3.rule}|${f3.where}|${f3.evidence ?? ""}`) },
      properties: { severity: f3.severity, where: f3.where }
    };
  });
  return JSON.stringify({
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [{
      tool: { driver: { name: "Patchlane", version: report.engineVersion, semanticVersion: report.engineVersion, informationUri: SITE_URL, rules } },
      results,
      invocations: [{ executionSuccessful: report.errors.length === 0, endTimeUtc: report.generatedAt }]
    }]
  }, null, 2);
}
function scenario(f3) {
  const op = f3.where.match(/^(GET|PUT|POST|DELETE|PATCH|HEAD|OPTIONS|TRACE) (\S+)/);
  const call = op ? `${op[1]} ${op[2]}` : f3.where;
  const id = (f3.evidence ?? "id").split(",")[0].trim();
  switch (f3.rule) {
    case "API1-OWNERSHIP":
      return [
        `Scenario: A user cannot reach another user's object through ${call}`,
        `  Given user "alice" owns a record with ${id} "A-1"`,
        `  And user "bob" is signed in`,
        `  When bob sends ${call} with ${id} "A-1"`,
        `  Then the response status is 404`,
        `  And the response contains none of alice's data`
      ];
    case "API2-PUBLIC-OP":
    case "REL-AUTH-REMOVED":
    case "REL-NEW-PUBLIC":
      return [
        `Scenario: ${call} refuses a request without a token`,
        `  Given no Authorization header is sent`,
        `  When the client sends ${call}`,
        `  Then the response status is 401`
      ];
    case "API3-SENSITIVE-OUT":
    case "REL-NEW-SENSITIVE":
      return [
        `Scenario: ${call} never returns secret fields`,
        `  Given user "alice" is signed in`,
        `  When alice sends ${call}`,
        `  Then the response body has no field named ${(f3.evidence ?? "").split(/,| and /).map((s) => `"${s.trim()}"`).filter((s) => s !== '""').slice(0, 3).join(", ") || "from the sensitive list"}`
      ];
    case "API3-MASS-ASSIGNMENT":
      return [
        `Scenario: ${call} ignores fields the user may not set`,
        `  Given user "bob" is signed in with role "member"`,
        `  When bob sends ${call} with ${(f3.evidence ?? "role").split(",")[0].trim()} set to a privileged value`,
        `  Then the stored record keeps its original ${(f3.evidence ?? "role").split(",")[0].trim()}`
      ];
    case "API4-NO-PAGING":
    case "API4-NO-MAX":
      return [
        `Scenario: ${call} caps the page size`,
        `  Given user "alice" is signed in`,
        `  When alice sends ${call} with limit 100000`,
        `  Then the response holds at most 100 items or the status is 400`
      ];
    case "API2-LOGIN-RATE":
      return [
        `Scenario: ${call} slows down repeated failures`,
        `  Given an account "alice@example.test"`,
        `  When 20 wrong passwords are sent to ${call} within one minute`,
        `  Then later attempts get status 429 with a Retry-After header`
      ];
    case "API5-ADMIN-PATH":
      return [
        `Scenario: An ordinary user cannot call ${call}`,
        `  Given user "bob" is signed in without the admin role`,
        `  When bob sends ${call}`,
        `  Then the response status is 403 or 404`
      ];
    case "API6-BUSINESS-FLOW":
      return [
        `Scenario: Repeating ${call} does not repeat the action`,
        `  Given user "alice" is signed in`,
        `  When alice sends ${call} twice with the same Idempotency-Key`,
        `  Then the action happens once and both responses match`
      ];
    case "API7-URL-INPUT":
    case "TOOL-URL-PARAM":
      return [
        `Scenario: ${call} refuses internal addresses`,
        `  Given user "alice" is signed in`,
        `  When alice sends ${call} with a URL on 127.0.0.1 or 169.254.169.254`,
        `  Then the response status is 400 and the server made no request`
      ];
    case "API8-ERROR-DETAIL":
    case "ERR-STACK":
      return [
        `Scenario: Errors from ${call} reveal no internals`,
        `  Given a request that makes the server fail`,
        `  When the client sends it`,
        `  Then the body holds an error code and a correlation id`,
        `  And the body contains no stack trace, SQL or file path`
      ];
    case "CORS-REFLECTED":
    case "CORS-WILDCARD-CREDS":
    case "CORS-NULL":
    case "CORS-WILDCARD":
      return [
        `Scenario: The API trusts only its own origins`,
        `  When a request arrives with Origin "https://unknown.example"`,
        `  Then Access-Control-Allow-Origin is absent`,
        `  And Access-Control-Allow-Credentials is absent`
      ];
    case "COOKIE-FLAGS":
      return [
        `Scenario: Session cookies carry their flags`,
        `  When a user signs in`,
        `  Then every Set-Cookie for the session has Secure, HttpOnly and SameSite`
      ];
    case "JWT-NO-SIGNATURE":
      return [
        `Scenario: The API refuses unsigned tokens`,
        `  Given a token with alg "none" and valid-looking claims`,
        `  When it is sent as a Bearer token`,
        `  Then the response status is 401`
      ];
    case "JWT-NO-EXP":
    case "JWT-EXPIRED":
      return [
        `Scenario: The API refuses expired tokens`,
        `  Given a correctly signed token whose exp is in the past`,
        `  When it is sent as a Bearer token`,
        `  Then the response status is 401`
      ];
    case "JWT-NO-AUD":
      return [
        `Scenario: The API refuses tokens issued for another API`,
        `  Given a correctly signed token with aud "another-api"`,
        `  When it is sent as a Bearer token`,
        `  Then the response status is 401`
      ];
    case "TOOL-NEEDS-APPROVAL":
    case "AGENT-APPROVAL":
      return [
        `Scenario: ${f3.where.replace(/^tool /, "Tool ")} waits for the user to confirm`,
        `  Given the agent calls ${f3.where.replace(/^tool /, "")} for user "alice"`,
        `  When no confirmation from alice has been received`,
        `  Then the action is stored as pending and nothing changes`
      ];
    case "TOOL-ID-PARAM":
      return [
        `Scenario: ${f3.where.split(" \xB7 ")[0].replace(/^tool /, "Tool ")} acts only for the signed-in user`,
        `  Given the agent runs for user "bob"`,
        `  When it calls the tool with ${f3.evidence ?? "user_id"} set to alice's id`,
        `  Then the tool returns no data of alice's`
      ];
    case "LLM-COST-LIMIT":
      return [
        `Scenario: ${call} enforces a per-user budget`,
        `  Given user "alice" has used her daily budget`,
        `  When alice sends ${call}`,
        `  Then the response status is 429`
      ];
    case "LLM-INPUT-LIMIT":
      return [
        `Scenario: ${call} refuses oversized prompts`,
        `  When the client sends ${call} with a 100,000 character prompt`,
        `  Then the response status is 413 or 422 and the model is not called`
      ];
    case "LLM-CLIENT-INSTRUCTIONS":
      return [
        `Scenario: ${call} keeps its instructions on the server`,
        `  When the client sends ${call} with a system message`,
        `  Then the system message is rejected or ignored`
      ];
    default:
      return null;
  }
}
function toGherkin(report) {
  const title = report.api?.title ?? "the API";
  const L = [
    `# Generated by Patchlane ${report.engineVersion} on ${report.generatedAt.slice(0, 10)}.`,
    "# Each scenario proves one control. Wire the steps to your test client (Cucumber, Behave, SpecFlow, Karate).",
    ""
  ];
  const byArea = /* @__PURE__ */ new Map();
  const seen = /* @__PURE__ */ new Set();
  for (const f3 of report.findings) {
    const s = scenario(f3);
    if (!s || seen.has(s[0])) continue;
    seen.add(s[0]);
    const k = AREA_LABEL[f3.area];
    if (!byArea.has(k)) byArea.set(k, []);
    byArea.get(k).push([`  # ${f3.rule} \xB7 ${f3.severity}`, ...s.map((x) => "  " + x)]);
  }
  L.push("@security", `Feature: Security controls of ${title}`, "");
  if (!byArea.size) return L.concat(["  # No findings that map to a scenario."]).join("\n") + "\n";
  for (const [area, scenarios] of byArea) {
    L.push(`  @${area.toLowerCase().replace(/[^a-z]+/g, "-")}`, `  Rule: ${area}`, "");
    for (const s of scenarios) L.push(...s.map((x) => "  " + x), "");
  }
  return L.join("\n");
}
function toWorkflow(opts = {}) {
  const spec = opts.spec || "openapi.yaml";
  const failOn = opts.failOn || "high";
  const lines = [
    "name: API security check",
    "",
    "on:",
    "  pull_request:",
    `    paths: ['${spec}']`,
    "  push:",
    "    branches: [main]",
    "",
    "permissions:",
    "  contents: read",
    "  security-events: write",
    "",
    "jobs:",
    "  patchlane:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v4"
  ];
  if (opts.compareBase) {
    lines.push(
      "        with:",
      "          fetch-depth: 0",
      "      - name: Get the spec from the base branch",
      "        if: github.event_name == 'pull_request'",
      `        run: git show "origin/\${{ github.base_ref }}:${spec}" > previous-spec.yaml || true`
    );
  }
  lines.push(
    "      - name: Check the API with Patchlane",
    `        uses: ${ACTION_REF}`,
    "        with:",
    `          spec: ${spec}`,
    ...opts.compareBase ? ["          previous: previous-spec.yaml"] : [],
    `          fail-on: ${failOn}`,
    "          sarif: patchlane.sarif",
    "          report: patchlane-report.md",
    "      - name: Send findings to code scanning",
    "        if: always()",
    "        uses: github/codeql-action/upload-sarif@v3",
    "        with:",
    "          sarif_file: patchlane.sarif",
    "          category: patchlane"
  );
  return lines.join("\n") + "\n";
}

// cli/patchlane.ts
var HELP = `Patchlane ${ENGINE_VERSION}: a security check-up for APIs and the AI agents that call them.

Usage
  patchlane check [spec] [options]     Check a spec and any other inputs given
  patchlane workflow [options]         Print a GitHub Actions workflow
  patchlane --version | --help

Inputs (any combination; spec may be "-" for stdin)
  --previous <file>        Previous release of the spec: adds the release check
  --response <file>        Raw HTTP response (curl -i output): headers, CORS, cookies
  --origin <origin>        The Origin the response was requested with, to test CORS
  --authenticated          The response belongs to a signed-in request
  --jwt <token|file>       A JSON Web Token to review (decoded locally, never sent)
  --tools <file>           MCP tools/list result, or an OpenAI / Anthropic tools array

Outputs
  --fail-on <level>        Exit 1 on a finding at this level or worse:
                           critical | high | medium | low | info | none (default: high)
  --sarif <file>           SARIF 2.1.0 for GitHub code scanning
  --report <file>          Markdown report
  --json <file>            JSON report
  --gherkin <file>         Given-When-Then security specs
  --framework <name>       Add fix code to the report: ${Object.keys(FRAMEWORK_LABEL).join(" | ")}
  --quiet                  Print only the summary line

Workflow options
  --spec <path>            Spec path in the repository (default: openapi.yaml)
  --compare-base           Also compare against the pull request's base branch
`;
function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=", 2);
      if (v !== void 0) out.flags[k] = v;
      else if (["authenticated", "quiet", "help", "version", "compare-base"].includes(k)) out.flags[k] = true;
      else {
        const next = argv[i + 1];
        if (next === void 0 || next.startsWith("--")) fail(`--${k} needs a value.`);
        out.flags[k] = next;
        i++;
      }
    } else if (a === "-h") out.flags.help = true;
    else if (a === "-v") out.flags.version = true;
    else out._.push(a);
  }
  return out;
}
var useColour = process.stdout.isTTY && !process.env.NO_COLOR;
var c = (code, s) => useColour ? `\x1B[${code}m${s}\x1B[0m` : s;
var SEV_COLOUR = { critical: "1;31", high: "31", medium: "33", low: "36", info: "2" };
function fail(msg) {
  process.stderr.write(`patchlane: ${msg}
`);
  process.exit(2);
}
function read(path, what) {
  if (path === "-") return readFileSync(0, "utf8");
  if (!existsSync(path)) fail(`${what} not found: ${path}`);
  return readFileSync(path, "utf8");
}
function write(path, text, what) {
  writeFileSync(path, text, "utf8");
  process.stderr.write(c("2", `  wrote ${what} to ${path}
`));
}
function ghData(s) {
  return s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}
function ghEscape(s) {
  return ghData(s).replace(/:/g, "%3A").replace(/,/g, "%2C");
}
function printReport(r, quiet) {
  const counts = SEVERITY_ORDER.filter((s) => r.bySeverity[s]).map((s) => c(SEV_COLOUR[s], `${r.bySeverity[s]} ${s}`)).join(", ");
  const title = r.api ? `${r.api.title} ${r.api.version}`.trim() : "API check-up";
  if (!quiet) {
    process.stdout.write(`
${c("1", `Patchlane \xB7 ${title}`)}  ${c("2", `checked: ${r.inputs.join(", ") || "nothing"}`)}

`);
    let area = "";
    for (const f3 of [...r.findings].sort((a, b) => a.area.localeCompare(b.area) || SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))) {
      if (f3.area !== area) {
        area = f3.area;
        process.stdout.write(c("1", `  ${AREA_LABEL[f3.area]}
`));
      }
      process.stdout.write(`    ${c(SEV_COLOUR[f3.severity], f3.severity.toUpperCase().padEnd(8))} ${f3.title}
`);
      process.stdout.write(`             ${c("2", f3.where)}${f3.evidence ? c("2", `  \xB7 ${f3.evidence.slice(0, 80)}`) : ""}
`);
      process.stdout.write(`             ${c("32", "fix")} ${f3.fix}
`);
    }
    if (r.docsScore) process.stdout.write(`
  Documentation score ${r.docsScore.score}/100
`);
    if (r.release) process.stdout.write(`  Release ${r.release.declared.from} \u2192 ${r.release.declared.to}: needs a ${r.release.requiredBump} bump${r.release.bumpOk ? "" : c("33", " (version number disagrees)")}
`);
  }
  for (const e of r.errors) process.stderr.write(c("31", `  ${e.input}: ${e.message}
`));
  process.stdout.write(`
  Grade ${c("1", r.grade.letter)} (${r.grade.score}/100) \xB7 ${r.findings.length} finding${r.findings.length === 1 ? "" : "s"}${counts ? ": " + counts : ""}

`);
}
function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  if (args.flags.version) {
    process.stdout.write(ENGINE_VERSION + "\n");
    return;
  }
  if (args.flags.help || !cmd) {
    process.stdout.write(HELP);
    return;
  }
  if (cmd === "workflow") {
    const failOn2 = String(args.flags["fail-on"] ?? "high");
    if (!SEVERITY_ORDER.includes(failOn2)) fail(`--fail-on must be one of ${SEVERITY_ORDER.join(", ")}.`);
    process.stdout.write(toWorkflow({ spec: String(args.flags.spec ?? "openapi.yaml"), failOn: failOn2, compareBase: !!args.flags["compare-base"] }));
    return;
  }
  if (cmd !== "check") fail(`unknown command "${cmd}". Run patchlane --help.`);
  const specPath = args._[1];
  const f3 = args.flags;
  const failOn = String(f3["fail-on"] ?? "high");
  if (failOn !== "none" && !SEVERITY_ORDER.includes(failOn)) fail(`--fail-on must be one of ${SEVERITY_ORDER.join(", ")}, none.`);
  const framework = f3.framework ? String(f3.framework) : void 0;
  if (framework && !(framework in FRAMEWORK_LABEL)) fail(`--framework must be one of ${Object.keys(FRAMEWORK_LABEL).join(", ")}.`);
  const spec = specPath ? read(specPath, "Spec") : void 0;
  let previousSpec;
  if (typeof f3.previous === "string" && f3.previous) {
    if (existsSync(f3.previous) && readFileSync(f3.previous, "utf8").trim()) previousSpec = readFileSync(f3.previous, "utf8");
    else process.stderr.write(c("2", `  no previous spec at ${f3.previous}; skipping the release check
`));
  }
  const jwtArg = typeof f3.jwt === "string" ? f3.jwt : void 0;
  const jwt = jwtArg ? existsSync(jwtArg) ? readFileSync(jwtArg, "utf8") : jwtArg : void 0;
  const response = typeof f3.response === "string" ? read(f3.response, "Response file") : void 0;
  const tools = typeof f3.tools === "string" ? read(f3.tools, "Tools file") : void 0;
  if (!spec && !response && !jwt && !tools) fail("nothing to check. Give a spec, or --response, --jwt or --tools.");
  const report = analyze({
    spec,
    previousSpec,
    response,
    jwt,
    tools,
    responseOptions: { testOrigin: typeof f3.origin === "string" ? f3.origin : void 0, authenticated: !!f3.authenticated }
  });
  printReport(report, !!f3.quiet);
  const files = { spec: specPath && specPath !== "-" ? specPath.replace(/\\/g, "/") : void 0, response: typeof f3.response === "string" ? f3.response : void 0, token: jwtArg && existsSync(jwtArg) ? jwtArg : void 0, tools: typeof f3.tools === "string" ? f3.tools : void 0 };
  if (typeof f3.sarif === "string") write(f3.sarif, toSarif(report, { files, specText: spec }), "SARIF");
  if (typeof f3.report === "string") write(f3.report, toMarkdown(report, framework), "report");
  if (typeof f3.json === "string") write(f3.json, toJson(report), "JSON");
  if (typeof f3.gherkin === "string") write(f3.gherkin, toGherkin(report), "security specs");
  if (process.env.GITHUB_ACTIONS === "true") {
    for (const x of report.findings) {
      if (x.severity === "info") continue;
      const level = x.severity === "critical" || x.severity === "high" ? "error" : x.severity === "medium" ? "warning" : "notice";
      const file = x.area === "server" ? files.response : x.area === "token" ? files.token : x.area === "agent" && x.where.startsWith("tool") ? files.tools : files.spec;
      const loc = file ? `file=${ghEscape(file)},line=${file === files.spec ? locateInSpec(spec, x.where) : 1},` : "";
      process.stdout.write(`::${level} ${loc}title=${ghEscape(`${x.rule}: ${x.title}`)}::${ghData(`${x.where}. ${x.fix}`)}
`);
    }
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, toMarkdown(report, framework) + "\n");
  }
  if (report.errors.some((e) => e.input === "spec")) process.exit(2);
  if (failsGate(report, failOn)) {
    process.stderr.write(c("31", `  Failing: at least one finding is ${failOn} or worse.
`));
    process.exit(1);
  }
}
main();
