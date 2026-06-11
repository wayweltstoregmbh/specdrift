"use strict";

function checkType(value, type) {
  switch (type) {
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "integer":
      return Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    default:
      return false;
  }
}

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function walk(value, schema, where, errors) {
  if (typeof schema !== "object" || schema === null) return;
  if (schema.const !== undefined && !same(value, schema.const)) {
    errors.push(`${where}: expected const ${JSON.stringify(schema.const)}`);
    return;
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((entry) => same(entry, value))) {
    errors.push(`${where}: value ${JSON.stringify(value)} not in enum`);
    return;
  }
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type) => checkType(value, type))) {
      errors.push(`${where}: expected type ${types.join("|")}`);
      return;
    }
  }
  if (Array.isArray(schema.anyOf)) {
    const passes = schema.anyOf.some((sub) => {
      const subErrors = [];
      walk(value, sub, where, subErrors);
      return subErrors.length === 0;
    });
    if (!passes) errors.push(`${where}: no anyOf branch matched`);
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${where}: string shorter than minLength ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${where}: string longer than maxLength ${schema.maxLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${where}: string does not match pattern ${schema.pattern}`);
    }
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${where}: number below minimum ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${where}: number above maximum ${schema.maximum}`);
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${where}: array shorter than minItems ${schema.minItems}`);
    }
    if (schema.items) {
      value.forEach((entry, index) => walk(entry, schema.items, `${where}[${index}]`, errors));
    }
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    for (const key of schema.required || []) {
      if (!(key in value)) errors.push(`${where}: missing required property "${key}"`);
    }
    const props = schema.properties || {};
    for (const [key, sub] of Object.entries(props)) {
      if (key in value) walk(value[key], sub, `${where}.${key}`, errors);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in props)) errors.push(`${where}: unexpected property "${key}"`);
      }
    }
  }
}

function validateAgainstSchema(value, schema) {
  const errors = [];
  walk(value, schema, "$", errors);
  return errors;
}

module.exports = { validateAgainstSchema };
