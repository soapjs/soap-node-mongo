import { MongoWhereParser } from "../mongo.where.parser";
import { Condition, VariedCondition, Where } from "@soapjs/soap";
import { ObjectId } from "mongodb";

describe("MongoWhereParser", () => {
  let parseSimpleConditionSpy, parseVariedConditionSpy;

  beforeEach(() => {
    // Setup spies or mocks before each test
    parseSimpleConditionSpy = jest.spyOn(
      MongoWhereParser as any,
      "parseSimpleCondition"
    );
    parseVariedConditionSpy = jest.spyOn(
      MongoWhereParser as any,
      "parseVariedCondition"
    );
  });

  afterEach(() => {
    // Clears all information stored in the mocks - call history, passed parameters, etc
    jest.clearAllMocks();

    // Alternatively, if you want to restore original functions (useful if the mocks alter behavior deeply)
    jest.restoreAllMocks();
  });

  describe("parse", () => {
    it("should return an empty object for null input", () => {
      expect(MongoWhereParser.parse(null)).toEqual({});
    });

    it("should handle simple conditions", () => {
      const condition = new Condition("name", "eq", "Alice");
      parseSimpleConditionSpy.mockReturnValue({ name: { $eq: "Alice" } });
      expect(MongoWhereParser.parse(condition)).toEqual({
        name: { $eq: "Alice" },
      });
    });

    it("should handle varied conditions", () => {
      const conditions = new VariedCondition(
        [new Condition("age", "gt", 30), new Condition("active", "eq", true)],
        "and"
      );
      parseVariedConditionSpy.mockReturnValue({
        $and: [{ age: { $gt: 30 } }, { active: { $eq: true } }],
      });
      expect(MongoWhereParser.parse(conditions)).toEqual({
        $and: [{ age: { $gt: 30 } }, { active: { $eq: true } }],
      });
    });

    it("should throw an error for unsupported data types", () => {
      expect(() => MongoWhereParser.parse("string" as any)).toThrow(
        "Invalid condition format"
      );
    });
  });

  describe("parseSimpleCondition", () => {
    it("should correctly parse an equality condition", () => {
      const condition = new Condition("status", "eq", "active");
      expect((MongoWhereParser as any).parseSimpleCondition(condition)).toEqual(
        {
          status: { $eq: "active" },
        }
      );
    });

    it("should convert id fields to ObjectId", () => {
      const condition = new Condition("_id", "eq", "507f1f77bcf86cd799439011");
      expect((MongoWhereParser as any).parseSimpleCondition(condition)).toEqual(
        {
          _id: { $eq: new ObjectId("507f1f77bcf86cd799439011") },
        }
      );
    });

    it("should handle 'like' operator as regex", () => {
      const condition = new Condition("name", "like", "john");
      expect((MongoWhereParser as any).parseSimpleCondition(condition)).toEqual(
        {
          name: { $regex: "john", $options: "i" },
        }
      );
    });
  });

  describe("parseVariedCondition", () => {
    it("should combine conditions using logical 'and'", () => {
      const conditions = new VariedCondition(
        [new Condition("age", "gt", 30), new Condition("active", "eq", true)],
        "and"
      );
      const result = (MongoWhereParser as any).parseVariedCondition(conditions);
      expect(result).toEqual({
        $and: [{ age: { $gt: 30 } }, { active: { $eq: true } }],
      });
    });

    it("should combine conditions using logical 'or'", () => {
      const conditions = new VariedCondition(
        [new Condition("age", "lt", 30), new Condition("active", "eq", false)],
        "or"
      );
      const result = (MongoWhereParser as any).parseVariedCondition(conditions);
      expect(result).toEqual({
        $or: [{ age: { $lt: 30 } }, { active: { $eq: false } }],
      });
    });

    it("should throw an error for unsupported logical operators", () => {
      const conditions = new VariedCondition(
        [new Condition("age", "gt", 30)],
        "xor" as any
      );
      expect(() =>
        (MongoWhereParser as any).parseVariedCondition(conditions)
      ).toThrow(`Unsupported logical operator xor`);
    });
  });
});
