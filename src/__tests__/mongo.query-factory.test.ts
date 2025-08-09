import { MongoQueryFactory } from "../mongo.query-factory";
import { FindParams, CountParams, RemoveParams, AggregationParams, UpdateMethod, Where } from "@soapjs/soap";

describe("MongoQueryFactory", () => {
  let factory: MongoQueryFactory<any>;

  beforeEach(() => {
    factory = new MongoQueryFactory();
  });

  describe("createFindQuery", () => {
    it("should create a find query with basic where conditions", () => {
      const where = new Where();
      where.valueOf("testField").isEq("value");
      
      const params: FindParams = {
        where,
        limit: 10,
        offset: 0,
        sort: { testField: 1 }
      };

      const result = factory.createFindQuery(params) as any;
      expect(result.filter).toEqual({ testField: "value" });
      expect(result.options.limit).toBe(10);
      expect(result.options.skip).toBe(0);
      expect(result.options.sort).toEqual({ testField: 1 });
    });

    it("should create a find query without where conditions", () => {
      const params: FindParams = {
        limit: 5
      };

      const result = factory.createFindQuery(params) as any;
      expect(result.filter).toEqual({});
      expect(result.options.limit).toBe(5);
    });
  });

  describe("createCountQuery", () => {
    it("should create a count query with where conditions", () => {
      const where = new Where();
      where.valueOf("testField").isEq("value");
      
      const params: CountParams = {
        where
      };

      const result = factory.createCountQuery(params) as any;
      expect(result.filter).toEqual({ testField: "value" });
    });

    it("should create a count query without where conditions", () => {
      const params: CountParams = {};

      const result = factory.createCountQuery(params) as any;
      expect(result.filter).toEqual({});
    });
  });

  describe("createUpdateQuery", () => {
    it("should handle UpdateOne method", () => {
      const where = new Where();
      where.valueOf("testField").isEq("oldValue");
      
      const updates = [{ testField: "newValue" }];
      const whereArray = [where];
      const methods = [UpdateMethod.UpdateOne];

      const result = factory.createUpdateQuery(updates, whereArray, methods) as any;
      expect(result.filter).toEqual({ testField: "oldValue" });
      expect(result.update).toEqual({ $set: { testField: "newValue" } });
    });

    it("should handle UpdateMany method", () => {
      const where = new Where();
      where.valueOf("testField").isEq("oldValue");
      
      const updates = [{ testField: "newValue" }];
      const whereArray = [where];
      const methods = [UpdateMethod.UpdateMany];

      const result = factory.createUpdateQuery(updates, whereArray, methods) as any;
      expect(result.filter).toEqual({ testField: "oldValue" });
      expect(result.update).toEqual({ $set: { testField: "newValue" } });
    });

    it("should throw error when update parameters count mismatch", () => {
      const updates = [{ field: "value" }];
      const where = [new Where()];
      const methods = [UpdateMethod.UpdateOne, UpdateMethod.UpdateMany];

      expect(() => {
        factory.createUpdateQuery(updates, where, methods);
      }).toThrow("Updates, where conditions, and methods arrays must have the same length");
    });
  });

  describe("createRemoveQuery", () => {
    it("should create a remove query based on where condition", () => {
      const where = new Where();
      where.valueOf("testField").isEq("value");
      
      const params: RemoveParams = {
        where
      };

      const result = factory.createRemoveQuery(params) as any;
      expect(result.filter).toEqual({ testField: "value" });
    });

    it("should create a remove query without where condition", () => {
      const params: RemoveParams = {};

      const result = factory.createRemoveQuery(params) as any;
      expect(result.filter).toEqual({});
    });
  });

  describe("createAggregationQuery", () => {
    it("should create an aggregation query with group and match stages", () => {
      const where = new Where();
      where.valueOf("testField").isEq("value");
      
      const params: AggregationParams = {
        where,
        groupBy: ["testField"],
        sum: "amount",
        sort: { totalAmount: -1 }
      };

      const result = factory.createAggregationQuery(params) as any;
      expect(result.pipeline).toContainEqual({
        $match: { testField: "value" }
      });
      expect(result.pipeline).toContainEqual({
        $group: {
          _id: { testField: "$testField" },
          amount: { $sum: "$amount" }
        }
      });
      expect(result.pipeline).toContainEqual({
        $sort: { totalAmount: -1 }
      });
    });

    it("should create an aggregation query without where condition", () => {
      const params: AggregationParams = {
        groupBy: ["category"],
        count: "total"
      };

      const result = factory.createAggregationQuery(params) as any;
      expect(result.pipeline).toContainEqual({
        $group: {
          _id: { category: "$category" },
          total: { $sum: 1 }
        }
      });
    });

    it("should handle multiple aggregation functions", () => {
      const params: AggregationParams = {
        groupBy: ["category"],
        sum: "amount",
        average: "price",
        min: "minPrice",
        max: "maxPrice",
        count: "total"
      };

      const result = factory.createAggregationQuery(params) as any;
      const groupStage = result.pipeline.find((stage: any) => stage.$group);
      expect(groupStage.$group.amount).toEqual({ $sum: "$amount" });
      expect(groupStage.$group.price).toEqual({ $avg: "$price" });
      expect(groupStage.$group.minPrice).toEqual({ $min: "$minPrice" });
      expect(groupStage.$group.maxPrice).toEqual({ $max: "$maxPrice" });
      expect(groupStage.$group.total).toEqual({ $sum: 1 });
    });
  });
});
