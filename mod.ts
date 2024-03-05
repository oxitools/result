/**
 * This module provides the `Result` class, a TypeScript implementation of the Rust's Result type,
 * offering a robust way to handle errors and success values without throwing exceptions.
 * It is particularly useful in functional programming patterns and scenarios where errors are expected
 * and need to be handled gracefully.
 *
 * The `Result` type is a union type that can either be `Ok`, representing success and containing a success value,
 * or `Err`, representing failure and containing an error value.
 *
 * Methods:
 * - `Ok`: Creates an `Ok` Result instance.
 * - `Err`: Creates an `Err` Result instance.
 * - `from`: Converts a function's return value or a promise to a Result.
 * - `wrap`: Wraps a function, ensuring it returns a Result.
 * - `match`: Applies functions based on the Result's state (Ok or Err).
 * - `isOk`, `isErr`: Check the state of the Result.
 * - `map`, `mapErr`: Transform the value inside the Result.
 * - `and`, `or`, `andThen`, `orElse`: Combine Result instances in various ways.
 * - `unwrap`, `unwrapOr`, `unwrapOrElse`: Extract values from the Result, with or without defaults.
 * - `expect`, `expectErr`: Unwrap with custom error messages.
 * - `toJSON`: Serialize the Result to a JSON object.
 * - `toString`: Get a string representation of the Result.
 *
 * @example
 * ```ts
 * // Creating an Ok Result
 * const okResult = Result.Ok(123);
 * console.log(okResult.toString()); // "Ok(123)"
 *
 * // Creating an Err Result
 * const errResult = Result.Err("An error occurred");
 * console.log(errResult.toString()); // "Err(An error occurred)"
 *
 * // Handling a Result with `match`
 * const result = Result.Ok(5);
 * const message = result.match(
 *   value => `Success with value: ${value}`,
 *   error => `Failed due to error: ${error}`
 * );
 * console.log(message); // "Success with value: 5"
 *
 * // Using `map` to transform an Ok value
 * const doubled = Result.Ok(2).map(x => x * 2);
 * console.log(doubled.unwrap()); // 4
 *
 * // Using `unwrapOr` to provide a default value for an Err
 * const value = Result.Err("Error").unwrapOr(42);
 * console.log(value); // 42
 *
 * // Using `from` to handle asynchronous operations
 * async function fetchData() {
 *   return "Data";
 * }
 * Result.from(fetchData).then(res => console.log(res.unwrap())); // "Data"
 *
 * // Combining Results with `andThen`
 * const queryResult = Result.Ok("Query");
 * const processResult = queryResult.andThen(query => Result.Ok(`Processed ${query}`));
 * console.log(processResult.unwrap()); // "Processed Query"
 * ```
 *
 * This module is designed to enhance error handling and functional programming patterns in TypeScript applications,
 * providing a more declarative approach to dealing with operations that can succeed or fail.
 * @module
 */

import { isPromise, raise } from "@oxi/core";

const TRUE = () => true;
const FALSE = () => false;
const IDENTITY = <T>(x: T) => x;
const NOOP = () => {};

// deno-lint-ignore no-explicit-any
type GenericFunction = (...args: any[]) => any;

type AsyncToResult<T extends GenericFunction> = ReturnType<T> extends Promise<
  infer U
>
  ? Promise<Result<U, unknown>>
  : Result<ReturnType<T>, unknown>;

/**
 * Represents a result of an operation that could be successful (Ok) or failed (Err).
 */
export class Result<T, E> {
  #ok: boolean;
  #value: T | E;

  private constructor(ok: boolean, value: T | E) {
    this.#ok = ok;
    this.#value = value;
  }

  /**
   * Creates an Ok result containing a success value.
   * @param value The success value.
   * @returns {Result<T, E>} An Ok result instance.
   * @example
   * const success = Result.Ok(42);
   */
  static Ok<T, E>(value: T): Result<T, E> {
    return new Result<T, E>(true, value);
  }

  /**
   * Creates an Err result containing an error value.
   * @param value The error value.
   * @returns {Result<T, E>} An Err result instance.
   * @example
   * const error = Result.Err(new Error("Something went wrong"));
   */
  static Err<T, E>(value: E): Result<T, E> {
    return new Result<T, E>(false, value);
  }

  /**
   * Creates a Result from a function that may return a value directly or a Promise of a value.
   * If the function returns a Promise, the resulting Promise will resolve to a Result.Ok with the resolved value
   * or a Result.Err with the rejection reason.
   * If the function returns a value directly, it will return a Result.Ok with the value,
   * or catch any thrown error and return a Result.Err with the error.
   * This method is generic and can handle both synchronous and asynchronous operations seamlessly.
   * @param fn A function that returns a value or a Promise of a value.
   * @returns {AsyncToResult<T>} A Result instance or a Promise that resolves to a Result instance,
   * depending on whether the input function is synchronous or asynchronous.
   * @example
   * ```ts
   * async function asyncOperation() {
   *   return "Async result";
   * }
   * function syncOperation() {
   *   return "Sync result";
   * }
   * function failingOperation() {
   *   throw new Error("Failure");
   * }
   *
   * // For asynchronous function
   * Result.from(asyncOperation).then(result =>
   *   console.log(result.unwrap())
   * ); // "Async result"
   *
   * // For synchronous function
   * console.log(Result.from(syncOperation).unwrap()); // "Sync result"
   *
   * // For function that throws
   * console.log(Result.from(failingOperation).unwrapErr().message); // "Failure"
   * ```
   */
  static from<T extends GenericFunction>(fn: T): AsyncToResult<T> {
    try {
      const value = fn();
      if (isPromise(value)) {
        return value.then(Result.Ok).catch(Result.Err) as AsyncToResult<T>;
      }
      return Result.Ok(value) as AsyncToResult<T>;
    } catch (error) {
      return Result.Err(error) as AsyncToResult<T>;
    }
  }

  /**
   * Wraps a function to return a Result or a Promise of a Result, instead of throwing errors.
   * @param fn A function to wrap.
   * @returns A function that returns a Result when invoked.
   * @example
   * const safeFunction = Result.wrap((x: number) => x + 1);
   * const result = safeFunction(1); // Result.Ok(2)
   */
  static wrap<T extends GenericFunction>(
    fn: T
  ): (...args: Parameters<T>) => AsyncToResult<T> {
    return function (...args: Parameters<T>): AsyncToResult<T> {
      return Result.from(() => fn(...args)) as AsyncToResult<T>;
    };
  }

  /**
   * Applies functions to the Result value, depending on whether it is Ok or Err.
   * @param onOk Function to apply to an Ok value.
   * @param onErr Function to apply to an Err value.
   * @returns The result of applying the appropriate function.
   * @example
   * const result = Result.Ok(5);
   * const doubled = result.match(
   *   value => value * 2,
   *   error => -1
   * ); // 10
   */
  match<U>(onOk: (value: T) => U, onErr: (value: E) => U): U {
    if (this.#ok) {
      return onOk(this.#value as T);
    }
    return onErr(this.#value as E);
  }

  /**
   * Checks if the Result is Ok.
   * @returns {boolean} True if the Result is Ok, false otherwise.
   * @example
   * const result = Result.Ok(5);
   * console.log(result.isOk()); // true
   */
  isOk(): boolean {
    return this.match(TRUE, FALSE);
  }

  /**
   * Checks if the Result is Ok and the contained value satisfies a given predicate.
   * @param predicate A function to test the Ok value.
   * @returns {boolean} True if the Result is Ok and the value satisfies the predicate, false otherwise.
   * @example
   * const result = Result.Ok(5);
   * console.log(result.isOkAnd(value => value > 3)); // true
   */
  isOkAnd(predicate: (value: T) => boolean): boolean {
    return this.match(predicate, FALSE);
  }

  /**
   * Checks if the Result is Err.
   * @returns {boolean} True if the Result is Err, false otherwise.
   * @example
   * const result = Result.Err("Error");
   * console.log(result.isErr()); // true
   */
  isErr(): boolean {
    return this.match(FALSE, TRUE);
  }

  /**
   * Checks if the Result is Err and the contained error satisfies a given predicate.
   * @param predicate A function to test the Err value.
   * @returns {boolean} True if the Result is Err and the error satisfies the predicate, false otherwise.
   * @example
   * const result = Result.Err("Error");
   * console.log(result.isErrAnd(error => error === "Error")); // true
   */
  isErrAnd(predicate: (value: E) => boolean): boolean {
    return this.match(FALSE, predicate);
  }

  /**
   * Transforms the Ok value of the Result using a given function, leaving an Err unchanged.
   * @param mapper A function that transforms an Ok value.
   * @returns {Result<U, E>} A Result with the Ok value transformed, or the original Err.
   * @example
   * const result = Result.Ok(2);
   * const squared = result.map(value => value * value);
   * console.log(squared.unwrap()); // 4
   */
  map<U>(mapper: (value: T) => U): Result<U, E> {
    return this.match(
      (value) => Result.Ok(mapper(value)),
      (value) => Result.Err(value)
    );
  }

  /**
   * Transforms the Ok value of the Result or returns a default value if the Result is Err.
   * @param defaultValue A default value to return if the Result is Err.
   * @param mapper A function that transforms an Ok value.
   * @returns {U} The transformed Ok value or the default value.
   * @example
   * const result = Result.Err("Error");
   * const value = result.mapOr(0, value => value * 2);
   * console.log(value); // 0
   */
  mapOr<U>(defaultValue: U, mapper: (value: T) => U): U {
    return this.match(mapper, () => defaultValue);
  }

  /**
   * Transforms the Ok value of the Result using a given function, or computes a default value if the Result is Err.
   * @param defaultMapper A function that provides a default value.
   * @param mapper A function that transforms an Ok value.
   * @returns {U} The transformed Ok value or the computed default value.
   * @example
   * const result = Result.Err("Error");
   * const value = result.mapOrElse(() => 0, value => value * 2);
   * console.log(value); // 0
   */
  mapOrElse<U>(defaultMapper: () => U, mapper: (value: T) => U): U {
    return this.match(mapper, () => defaultMapper());
  }

  /**
   * Transforms the Err value of the Result using a given function, leaving an Ok unchanged.
   * @param mapper A function that transforms an Err value.
   * @returns {Result<T, U>} A Result with the Err value transformed, or the original Ok.
   * @example
   * const result = Result.Err("old error");
   * const updatedError = result.mapErr(error => `new ${error}`);
   * console.log(updatedError.unwrapErr()); // "new old error"
   */
  mapErr<U>(mapper: (value: E) => U): Result<T, U> {
    return this.match(
      (value) => Result.Ok(value),
      (value) => Result.Err(mapper(value))
    );
  }

  /**
   * Performs a side-effect with the Ok value if the Result is Ok, and does nothing if it is Err.
   * @param onOk A function to perform side-effects with the Ok value.
   * @returns {this} The original Result, for method chaining.
   * @example
   * const result = Result.Ok(5);
   * result.inspect(value => console.log(`Got value: ${value}`));
   * // Logs: "Got value: 5"
   */
  inspect(onOk: (value: T) => void): this {
    this.match(onOk, NOOP);
    return this;
  }

  /**
   * Performs a side-effect with the Err value if the Result is Err, and does nothing if it is Ok.
   * @param onErr A function to perform side-effects with the Err value.
   * @returns {this} The original Result, for method chaining.
   * @example
   * const result = Result.Err("Oops");
   * result.inspectErr(error => console.log(`Encountered error: ${error}`));
   * // Logs: "Encountered error: Oops"
   */
  inspectErr(onErr: (value: E) => void): this {
    this.match(NOOP, onErr);
    return this;
  }

  /**
   * Unwraps a Result, yielding the content of an Ok. Throws an error with the given message if the Result is Err.
   * @param message The error message to throw if the Result is Err.
   * @returns {T} The Ok value.
   * @example
   * ```ts
   * const result = Result.Ok(5);
   * console.log(result.expect("Failed to unwrap")); // 5
   * ```
   */
  expect(message: string): T {
    return this.match(IDENTITY, (error) => raise(message, { cause: error }));
  }

  /**
   * Unwraps a Result, yielding the content of an Ok. Throws an error if the Result is Err.
   * @returns {T} The Ok value.
   * @example
   * ```ts
   * const result = Result.Ok(5);
   * console.log(result.unwrap()); // 5
   * ```
   */
  unwrap(): T {
    return this.expect("called `Result.unwrap()` on an `Err` value");
  }

  /**
   * Unwraps a Result, yielding the content of an Ok, or a default value if the Result is Err.
   * @param defaultValue The default value to return if the Result is Err.
   * @returns {T} The Ok value or the default value.
   * @example
   * ```ts
   * const result = Result.Err("Error");
   * console.log(result.unwrapOr(0)); // 0
   * ```
   */
  unwrapOr(defaultValue: T): T {
    return this.match(IDENTITY, () => defaultValue);
  }

  /**
   * Unwraps a Result, yielding the content of an Ok, or computes a default value from a function if the Result is Err.
   * @param defaultMapper A function that provides a default value.
   * @returns {T} The Ok value or the computed default value.
   * @example
   * ```ts
   * const result = Result.Err("Error");
   * console.log(result.unwrapOrElse(() => 0)); // 0
   * ```
   */
  unwrapOrElse(defaultMapper: () => T): T {
    return this.match(IDENTITY, defaultMapper);
  }

  /**
   * Unwraps a Result, yielding the content of an Err. Throws an error with the given message if the Result is Ok.
   * @param message The error message to throw if the Result is Ok.
   * @returns {E} The Err value.
   * @example
   * ```ts
   * const result = Result.Err("Error");
   * console.log(result.expectErr("Failed to unwrap Err")); // "Error"
   * ```
   */
  expectErr(message: string): E {
    return this.match((value) => raise(message, { cause: value }), IDENTITY);
  }

  /**
   * Unwraps a Result, yielding the content of an Err. Throws an error if the Result is Ok.
   * @returns {E} The Err value.
   * @example
   * ```ts
   * const result = Result.Err("Error");
   * console.log(result.unwrapErr()); // "Error"
   * ```
   */
  unwrapErr(): E {
    return this.expectErr("called `Result.unwrapErr()` on an `Ok` value");
  }

  /**
   * Returns the provided Ok result if the original Result is Ok, otherwise returns the original Err.
   * @param result The Ok result to return if the original Result is Ok.
   * @returns {Result<U, E>} The provided Ok result or the original Err.
   * @example
   * ```ts
   * const result1 = Result.Ok(2);
   * const result2 = Result.Ok(3);
   * console.log(result1.and(result2).unwrap()); // 3
   * ```
   */
  and<U>(result: Result<U, E>): Result<U, E> {
    return this.match(
      () => result,
      (value) => Result.Err(value)
    );
  }

  /**
   * Applies a function to the contained Ok value, or returns the original Err if the original Result is Err.
   * @param mapper A function that takes an Ok value and returns a Result.
   * @returns {Result<U, E>} The result of applying the function to the Ok value, or the original Err.
   * @example
   * ```ts
   * const result = Result.Ok(2);
   * const doubled = result.andThen(value => Result.Ok(value * 2));
   * console.log(doubled.unwrap()); // 4
   * ```
   */
  andThen<U>(mapper: (value: T) => Result<U, E>): Result<U, E> {
    return this.match(mapper, (value) => Result.Err(value));
  }

  /**
   * Returns the provided Err result if the original Result is Err, otherwise returns the original Ok.
   * @param result The Err result to return if the original Result is Err.
   * @returns {Result<T, F>} The original Ok or the provided Err result.
   * @example
   * ```ts
   * const result1 = Result.Err("Error 1");
   * const result2 = Result.Err("Error 2");
   * console.log(result1.or(result2).unwrapErr()); // "Error 2"
   * ```
   */
  or<F>(result: Result<T, F>): Result<T, F> {
    return this.match(
      (value) => Result.Ok(value),
      () => result
    );
  }

  /**
   * Applies a function to the contained Err value, or returns the original Ok if the original Result is Ok.
   * @param mapper A function that takes an Err value and returns a Result.
   * @returns {Result<T, F>} The original Ok or the result of applying the function to the Err value.
   * @example
   * ```ts
   * const result = Result.Err("Error");
   * const recovered = result.orElse(err => Result.Ok("Recovered"));
   * console.log(recovered.unwrap()); // "Recovered"
   * ```
   */
  orElse<F>(mapper: (value: E) => Result<T, F>): Result<T, F> {
    return this.match((value) => Result.Ok(value), mapper);
  }

  /**
   * Serializes the Result to a JSON object representation with an `ok` field indicating success or failure and a `value` or `error` field containing the respective data.
   * If the Result is Ok, the object will have `{ ok: true, value: T }`. If the Result is Err, the object will have `{ ok: false, error: E }`.
   * @returns {{ ok: true; value: T } | { ok: false; error: E }} A JSON object representation of the Result.
   * @example
   * ```ts
   * const okResult = Result.Ok(5);
   * console.log(okResult.toJSON()); // { ok: true, value: 5 }
   *
   * const errResult = Result.Err("Error");
   * console.log(errResult.toJSON()); // { ok: false, error: "Error" }
   * ```
   */
  toJSON(): { ok: true; value: T } | { ok: false; error: E } {
    return this.match<{ ok: true; value: T } | { ok: false; error: E }>(
      (value) => ({ ok: true, value }),
      (error) => ({ ok: false, error })
    );
  }

  /**
   * Returns a string representation of the Result, with `Ok(value)` if the Result is Ok, or `Err(error)` if the Result is Err.
   * This method provides a human-readable representation of the Result, which can be useful for debugging or logging.
   * @returns {string} The string representation of the Result.
   * @example
   * ```ts
   * const okResult = Result.Ok(5);
   * console.log(okResult.toString()); // "Ok(5)"
   *
   * const errResult = Result.Err("Error");
   * console.log(errResult.toString()); // "Err(Error)"
   * ```
   */
  toString(): string {
    return this.match(
      (value) => `Ok(${JSON.stringify(value)})`,
      (error) => `Err(${JSON.stringify(error)})`
    );
  }
}
