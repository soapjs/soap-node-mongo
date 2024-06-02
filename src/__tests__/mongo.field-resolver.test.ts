import { Condition, VariedCondition } from "@soapjs/soap";
import { MongoFieldResolver } from "../mongo.field-resolver";

describe("MongoFieldResolver", () => {
  let resolver;

  beforeEach(() => {
    const fieldMappings = {
      name: { name: "customerName", type: "string" },
    };
    resolver = new MongoFieldResolver({ modelFieldMappings: fieldMappings });
  });

  test("should resolve a simple object", () => {
    const obj = { name: "John" };
    const resolved = resolver.resolve(obj);
    expect(resolved).toEqual({ customerName: "John" });
  });

  test("should handle Condition objects", () => {
    const condition = new Condition("name", "eq", "John");
    const resolved = resolver.resolve(condition);
    expect(resolved.left).toEqual("customerName");
    expect(resolved.operator).toEqual("eq");
    expect(resolved.right).toEqual("John");
  });

  test("should handle VariedCondition objects", () => {
    const condition1 = new Condition("name", "eq", "John");
    const condition2 = new Condition("name", "eq", "Doe");
    const variedCondition = new VariedCondition(
      [condition1, condition2],
      "and"
    );
    const resolved = resolver.resolve(variedCondition);
    expect(resolved.conditions.length).toBe(2);
    expect(resolved.conditions[0].left).toEqual("customerName");
    expect(resolved.conditions[1].left).toEqual("customerName");
    expect(resolved.operator).toEqual("and");
  });
});
