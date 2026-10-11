import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GEAR_ADMIN_RENTAL_LOCATION,
  NO_RENTAL_INSTITUTION_MESSAGE,
  loadRentalInstitutionOptions,
  resolveChosenRentalLocation,
  shouldAutofillRentalLocation,
  withGearAdminRentalChoice,
} from "./rentalInstitutionOptions.js";

const schools = [
  { id: "a", name: "광교폴리", is_active: true },
  { id: "b", name: "성동ecc", is_active: true },
  { id: "c", name: "쉬는 원", is_active: false },
];

describe("대여 기관 목록", () => {
  it("일반 선생님은 배정 기관만 두고 교구 관리자 대여를 붙이지 않는다", () => {
    const options = withGearAdminRentalChoice(schools, false);
    assert.deepEqual(options.map((row) => row.name), ["광교폴리", "성동ecc"]);
  });

  it("교구 관리자는 전체 기관 뒤에 교구 관리자 대여를 붙인다", () => {
    const options = withGearAdminRentalChoice(schools, true);
    assert.deepEqual(options.map((row) => row.name), ["광교폴리", "성동ecc", GEAR_ADMIN_RENTAL_LOCATION]);
    assert.equal(options.at(-1).synthetic, true);
  });

  it("기관이 없어도 교구 관리자는 교구 관리자 대여만 남긴다", () => {
    const options = withGearAdminRentalChoice([], true);
    assert.equal(options.length, 1);
    assert.equal(options[0].name, GEAR_ADMIN_RENTAL_LOCATION);
    assert.equal(shouldAutofillRentalLocation({ loading: false, canChoose: true, options }), true);
  });

  it("기관이 여러 개면 자동으로 고르지 않는다", () => {
    const options = withGearAdminRentalChoice(schools, true);
    assert.equal(shouldAutofillRentalLocation({ loading: false, canChoose: true, options }), false);
  });

  it("소속 기관이 하나인 선생님은 그 기관으로 고정한다", () => {
    const options = withGearAdminRentalChoice([schools[0]], false);
    assert.equal(shouldAutofillRentalLocation({ loading: false, canChoose: false, options }), true);
    assert.equal(resolveChosenRentalLocation("", options, false), "광교폴리");
  });

  it("교구 관리자 대여는 기관 id 없이 그 문구로 저장된다", () => {
    const options = withGearAdminRentalChoice(schools, true);
    assert.equal(
      resolveChosenRentalLocation(GEAR_ADMIN_RENTAL_LOCATION, options, true),
      GEAR_ADMIN_RENTAL_LOCATION,
    );
  });

  it("일반 선생님은 목록에 없는 기관명을 쓸 수 없다", () => {
    const options = withGearAdminRentalChoice(schools, false);
    assert.throws(
      () => resolveChosenRentalLocation(GEAR_ADMIN_RENTAL_LOCATION, options, false),
      /사용 기관을 선택해 주세요/,
    );
    assert.throws(
      () => resolveChosenRentalLocation("광교폴리", [], false),
      new RegExp(NO_RENTAL_INSTITUTION_MESSAGE),
    );
  });

  it("선생님 조회는 배정 RPC만 호출한다", async () => {
    const calls = [];
    const client = {
      rpc(name) {
        calls.push(name);
        return Promise.resolve({
          data: [{ id: "elan", name: "엘란어학원", is_active: true }],
          error: null,
        });
      },
      from() {
        throw new Error("institutions 테이블을 조회하면 안 된다");
      },
    };
    const options = await loadRentalInstitutionOptions(client, { id: "teacher" }, { canChooseAll: false });
    assert.deepEqual(calls, ["get_teacher_assigned_institutions"]);
    assert.deepEqual(options.map((row) => row.name), ["엘란어학원"]);
  });

  it("함수가 아직 없으면 교구 관리자는 교구 관리자 대여로 남긴다", async () => {
    const client = {
      rpc() {
        return Promise.resolve({
          data: null,
          error: { code: "PGRST202", message: "Could not find the function public.get_rental_institution_options" },
        });
      },
      from() {
        return {
          select() { return this; },
          eq() { return this; },
          order() {
            return Promise.resolve({ data: [], error: null });
          },
        };
      },
    };
    const options = await loadRentalInstitutionOptions(client, { id: "admin" }, { canChooseAll: true });
    assert.deepEqual(options.map((row) => row.name), [GEAR_ADMIN_RENTAL_LOCATION]);
  });
});
