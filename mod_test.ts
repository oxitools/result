import { isDefined, raise } from "@oxi/core";
import {
  assert,
  assertEquals,
  assertFalse,
  assertThrows,
} from "https://deno.land/std@0.218.0/assert/mod.ts";
import { Result } from "./mod.ts";

function assertOk<T, E>(
  result: Result<T, E>,
  value?: T
): asserts result is Result<T, E> {
  assert(result.isOk(), `Expected Ok, got Err`);
  if (isDefined(value)) {
    assertEquals(result.unwrap(), value);
  }
}

function assertErr<T, E>(
  result: Result<T, E>,
  value?: E
): asserts result is Result<T, E> {
  assert(result.isErr(), `Expected Err, got Ok`);
  if (isDefined(value)) {
    assertEquals(result.unwrapErr(), value);
  }
}

function ok(value = 10): Result<number, string> {
  return Result.Ok(value);
}

function err(error = "error"): Result<number, string> {
  return Result.Err(error);
}

Deno.test("Result#Ok", () => {
  const result = ok(42);
  assertOk(result, 42);
});

Deno.test("Result#Err", () => {
  const result = err("error");
  assertErr(result, "error");
});

Deno.test("Result#from", async () => {
  let result = Result.from(() => 42);
  assertOk(result, 42);
  result = Result.from((): number => raise("error"));
  assertErr(result);
  result = await Result.from(() => Promise.resolve(42));
  assertOk(result, 42);
  result = await Result.from(() => Promise.reject<number>("error"));
  assertErr(result);
});

Deno.test("Result#wrap", async () => {
  let wrapped = Result.wrap((name: string) => `Hello, ${name}!`);
  let result = wrapped("world");
  assertOk(result, "Hello, world!");
  wrapped = Result.wrap((_: string): string => raise("error"));
  result = wrapped("world");
  assertErr(result);
  let wrapped2 = Result.wrap((name: string) =>
    Promise.resolve(`Hello, ${name}!`)
  );
  let result2 = await wrapped2("world");
  assertOk(result2, "Hello, world!");
  wrapped2 = Result.wrap((_: string) => Promise.reject("error"));
  result2 = await wrapped("world");
  assertErr(result2);
});

Deno.test("Result.match", () => {
  let value = 0;
  ok().match(
    () => (value = 1),
    () => (value = -1)
  );
  assertEquals(value, 1);
  err().match(
    () => (value = 1),
    () => (value = -1)
  );
  assertEquals(value, -1);
});

Deno.test("Result.isOk", () => {
  assert(ok().isOk());
  assertFalse(err().isOk());
});

Deno.test("Result.isOkAnd", () => {
  assert(ok().isOkAnd((value) => value === 10));
  assertFalse(ok().isOkAnd((value) => value === 20));
  assertFalse(err().isOkAnd((value) => value === 10));
});

Deno.test("Result.isErr", () => {
  assertFalse(ok().isErr());
  assert(err().isErr());
});

Deno.test("Result.isErrAnd", () => {
  assertFalse(ok().isErrAnd((error) => error === "error"));
  assert(err().isErrAnd((error) => error === "error"));
});

Deno.test("Result.map", () => {
  let result = ok(42).map((value) => value * 2);
  assertOk(result, 84);
  result = err("error").map((value) => value * 2);
  assertErr(result, "error");
});

Deno.test("Result.mapErr", () => {
  let result = ok(42).mapErr((error) => error.toUpperCase());
  assertOk(result, 42);
  result = err("error").mapErr((error) => error.toUpperCase());
  assertErr(result, "ERROR");
});

Deno.test("Result.mapOr", () => {
  let result = ok(42).mapOr(0, (value) => value * 2);
  assertEquals(result, 84);
  result = err("error").mapOr(0, (value) => value * 2);
  assertEquals(result, 0);
});

Deno.test("Result.mapOrElse", () => {
  let result = ok(42).mapOrElse(
    () => 0,
    (value) => value * 2
  );
  assertEquals(result, 84);
  result = err("error").mapOrElse(
    () => 0,
    (value) => value * 2
  );
  assertEquals(result, 0);
});

Deno.test("Result.inspect", () => {
  let value = 0;
  ok(42).inspect(() => (value = 1));
  assertEquals(value, 1);
  value = 0;
  err("error").inspect(() => (value = 1));
  assertEquals(value, 0);
});

Deno.test("Result.inspectErr", () => {
  let value = 0;
  ok(42).inspectErr(() => (value = 1));
  assertEquals(value, 0);
  value = 0;
  err("error").inspectErr(() => (value = 1));
  assertEquals(value, 1);
});

Deno.test("Result.expect", () => {
  assertThrows(() => err().expect("error message"), Error, "error message");
  assertEquals(ok(42).expect("error message"), 42);
});

Deno.test("Result.unwrap", () => {
  assertEquals(ok(42).unwrap(), 42);
  assertThrows(
    () => err().unwrap(),
    Error,
    "called `Result.unwrap()` on an `Err` value"
  );
});

Deno.test("Result.unwrapOr", () => {
  assertEquals(ok(42).unwrapOr(0), 42);
  assertEquals(err("error").unwrapOr(0), 0);
});

Deno.test("Result.unwrapOrElse", () => {
  assertEquals(
    ok(42).unwrapOrElse(() => 0),
    42
  );
  assertEquals(
    err("error").unwrapOrElse(() => 0),
    0
  );
});

Deno.test("Result.expectErr", () => {
  assertThrows(() => ok(42).expectErr("error message"), Error, "error message");
  assertEquals(err("error").expectErr("error message"), "error");
});

Deno.test("Result.unwrapErr", () => {
  assertEquals(err("error").unwrapErr(), "error");
  assertThrows(
    () => ok(42).unwrapErr(),
    Error,
    "called `Result.unwrapErr()` on an `Ok` value"
  );
});

Deno.test("Result.and", () => {
  let result = ok(42).and(ok(10));
  assertOk(result, 10);
  result = ok(42).and(err("error"));
  assertErr(result, "error");
  result = err("error").and(ok(10));
  assertErr(result, "error");
  result = err("error").and(err("error"));
  assertErr(result, "error");
});

Deno.test("Result.andThen", () => {
  let result = ok(42).andThen((value) => ok(value * 2));
  assertOk(result, 84);
  result = ok(42).andThen(() => err("error"));
  assertErr(result, "error");
  result = err("error").andThen((value) => ok(value * 2));
  assertErr(result, "error");
  result = err("error").andThen(() => err("error"));
  assertErr(result, "error");
});

Deno.test("Result.or", () => {
  let result = ok(42).or(ok(10));
  assertOk(result, 42);
  result = ok(42).or(err("error"));
  assertOk(result, 42);
  result = err("error").or(ok(10));
  assertOk(result, 10);
  result = err("error").or(err("error"));
  assertErr(result, "error");
});

Deno.test("Result.orElse", () => {
  let result = ok(42).orElse(() => ok(10));
  assertOk(result, 42);
  result = ok(42).orElse(() => err("error"));
  assertOk(result, 42);
  result = err("error").orElse(() => ok(10));
  assertOk(result, 10);
  result = err("error").orElse(() => err("error"));
  assertErr(result, "error");
});

Deno.test("Result.toJSON", () => {
  assertEquals(JSON.stringify(ok(42)), JSON.stringify({ ok: true, value: 42 }));
  assertEquals(
    JSON.stringify(err("error")),
    JSON.stringify({ ok: false, error: "error" })
  );
});

Deno.test("Result.toString", () => {
  assertEquals(ok(42).toString(), "Ok(42)");
  assertEquals(err("error").toString(), 'Err("error")');
});
