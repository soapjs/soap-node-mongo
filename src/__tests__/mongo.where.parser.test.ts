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

describe('MongoWhereParser - New Methods', () => {
  let parser: MongoWhereParser;

  beforeEach(() => {
    parser = new MongoWhereParser();
  });

  describe('jsonExtract', () => {
    it('should parse jsonExtract condition correctly', () => {
      const mockWhere = {
        build: () => ({
          left: 'metadata',
          operator: 'json_extract',
          right: { path: 'user.name', value: 'John' }
        })
      };

      const result = parser.parse(mockWhere);

      expect(result).toEqual({
        $expr: {
          $eq: [
            { $getField: { field: 'user.name', input: '$metadata' } },
            'John'
          ]
        }
      });
    });

    it('should handle jsonExtract with simple value', () => {
      const mockWhere = {
        build: () => ({
          left: 'data',
          operator: 'json_extract',
          right: 'simple_value'
        })
      };

      const result = parser.parse(mockWhere);

      expect(result).toEqual({
        data: 'simple_value'
      });
    });
  });

  describe('fullTextSearch', () => {
    it('should parse fullTextSearch condition correctly', () => {
      const mockWhere = {
        build: () => ({
          left: 'content',
          operator: 'full_text_search',
          right: 'search term'
        })
      };

      const result = parser.parse(mockWhere);

      expect(result).toEqual({
        $text: { $search: 'search term' }
      });
    });
  });

  describe('arrayContains', () => {
    it('should parse arrayContains condition with array value', () => {
      const mockWhere = {
        build: () => ({
          left: 'tags',
          operator: 'array_contains',
          right: ['tag1', 'tag2']
        })
      };

      const result = parser.parse(mockWhere);

      expect(result).toEqual({
        tags: { $all: ['tag1', 'tag2'] }
      });
    });

    it('should parse arrayContains condition with single value', () => {
      const mockWhere = {
        build: () => ({
          left: 'categories',
          operator: 'array_contains',
          right: 'category1'
        })
      };

      const result = parser.parse(mockWhere);

      expect(result).toEqual({
        categories: { $all: ['category1'] }
      });
    });
  });

  describe('textSearch', () => {
    it('should parse textSearch condition correctly', () => {
      const mockWhere = {
        build: () => ({
          left: 'description',
          operator: 'text_search',
          right: 'search text'
        })
      };

      const result = parser.parse(mockWhere);

      expect(result).toEqual({
        description: { $regex: 'search text', $options: 'i' }
      });
    });

    it('should handle textSearch with non-string value', () => {
      const mockWhere = {
        build: () => ({
          left: 'field',
          operator: 'text_search',
          right: 123
        })
      };

      const result = parser.parse(mockWhere);

      expect(result).toEqual({
        field: 123
      });
    });
  });

  describe('complex queries with new operators', () => {
    it('should handle AND condition with new operators', () => {
      const mockWhere = {
        build: () => ({
          conditions: [
            {
              left: 'title',
              operator: 'text_search',
              right: 'important'
            },
            {
              left: 'tags',
              operator: 'array_contains',
              right: ['urgent', 'critical']
            }
          ],
          operator: 'and'
        })
      };

      const result = parser.parse(mockWhere);

      expect(result).toEqual({
        $and: [
          { title: { $regex: 'important', $options: 'i' } },
          { tags: { $all: ['urgent', 'critical'] } }
        ]
      });
    });

    it('should handle OR condition with new operators', () => {
      const mockWhere = {
        build: () => ({
          conditions: [
            {
              left: 'content',
              operator: 'full_text_search',
              right: 'search term'
            },
            {
              left: 'metadata',
              operator: 'json_extract',
              right: { path: 'priority', value: 'high' }
            }
          ],
          operator: 'or'
        })
      };

      const result = parser.parse(mockWhere);

      expect(result).toEqual({
        $or: [
          { $text: { $search: 'search term' } },
          {
            $expr: {
              $eq: [
                { $getField: { field: 'priority', input: '$metadata' } },
                'high'
              ]
            }
          }
        ]
      });
    });
  });
});
