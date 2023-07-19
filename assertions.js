/**
 * Asserts that a value is truthy.
 * Mostly used to narrow down the type for TypeScript.
 * Needs to be a function declaration, not an arrow function.
 *
 * @param {any} value
 * @param {string} [message]
 * @returns {asserts value}
 */
export function assertTruthy(value, message) {
  if (!value) {
    throw new TypeError(message || `Expects value ${value} to be truthy`);
  }
}

/**
 * Asserts that a value is defined.
 * Mostly used to narrow down the type for TypeScript.
 * Needs to be a function declaration, not an arrow function.
 *
 * @template T
 * @param {T} value
 * @param {string} [message]
 * @returns {asserts value is NonNullable<T>}
 */
export function assertDefined(value, message) {
  if (value === undefined || value === null) {
    throw new TypeError(message || `Expects value ${value} to be defined`);
  }
}
