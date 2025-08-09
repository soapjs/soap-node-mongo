import { MongoWhereParser } from "../mongo.where.parser";
import { Where, Condition, VariedCondition } from "@soapjs/soap";

describe("MongoWhereParser", () => {
  let parser: MongoWhereParser;

  beforeEach(() => {
    parser = new MongoWhereParser();
  });

  describe("parse", () => {
    it("should return an empty object for null input", () => {
      const result = parser.parse(null as any);
      expect(result).toEqual({});
    });

    it("should handle simple conditions", () => {
      const where = new Where();
      where.valueOf("testField").isEq("value");
      
      const result = parser.parse(where);
      expect(result).toEqual({ testField: "value" });
    });

    it("should handle varied conditions", () => {
      const where = new Where();
      where.valueOf("field1").isEq("value1");
      where.and.valueOf("field2").isEq("value2");
      
      const result = parser.parse(where);
      expect(result).toEqual({
        $and: [
          { field1: "value1" },
          { field2: "value2" }
        ]
      });
    });

    it("should handle OR conditions", () => {
      const where = new Where();
      where.valueOf("field1").isEq("value1");
      where.or.valueOf("field2").isEq("value2");
      
      const result = parser.parse(where);
      expect(result).toEqual({
        $or: [
          { field1: "value1" },
          { field2: "value2" }
        ]
      });
    });
  });

  describe("parseCondition", () => {
    it("should correctly parse an equality condition", () => {
      const condition = new Condition("testField", "eq", "value");
      const result = parser.parse(new Where().valueOf("testField").isEq("value"));
      expect(result).toEqual({ testField: "value" });
    });

    it("should handle 'ne' operator", () => {
      const where = new Where();
      where.valueOf("testField").isNotEq("value");
      
      const result = parser.parse(where);
      expect(result).toEqual({ testField: { $ne: "value" } });
    });

    it("should handle 'gt' operator", () => {
      const where = new Where();
      where.valueOf("testField").isGt(10);
      
      const result = parser.parse(where);
      expect(result).toEqual({ testField: { $gt: 10 } });
    });

    it("should handle 'gte' operator", () => {
      const where = new Where();
      where.valueOf("testField").isGte(10);
      
      const result = parser.parse(where);
      expect(result).toEqual({ testField: { $gte: 10 } });
    });

    it("should handle 'lt' operator", () => {
      const where = new Where();
      where.valueOf("testField").isLt(10);
      
      const result = parser.parse(where);
      expect(result).toEqual({ testField: { $lt: 10 } });
    });

    it("should handle 'lte' operator", () => {
      const where = new Where();
      where.valueOf("testField").isLte(10);
      
      const result = parser.parse(where);
      expect(result).toEqual({ testField: { $lte: 10 } });
    });

    it("should handle 'in' operator", () => {
      const where = new Where();
      where.valueOf("testField").isIn(["value1", "value2"]);
      
      const result = parser.parse(where);
      expect(result).toEqual({ testField: { $in: ["value1", "value2"] } });
    });

    it("should handle 'nin' operator", () => {
      const where = new Where();
      where.valueOf("testField").areNotIn(["value1", "value2"]);
      
      const result = parser.parse(where);
      expect(result).toEqual({ testField: { $nin: ["value1", "value2"] } });
    });

    it("should handle 'like' operator as regex", () => {
      const where = new Where();
      where.valueOf("testField").like("pattern");
      
      const result = parser.parse(where);
      expect(result).toEqual({ testField: { $regex: "^pattern$", $options: "i" } });
    });
  });

  describe("static parse", () => {
    it("should work as static method", () => {
      const where = new Where();
      where.valueOf("testField").isEq("value");
      
      const result = MongoWhereParser.parse(where);
      expect(result).toEqual({ testField: "value" });
    });
  });
});
