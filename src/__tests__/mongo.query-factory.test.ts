import { MongoQueryFactory } from "../mongo.query-factory";
import { Condition, VariedCondition, Where, UpdateMethod } from "@soapjs/soap";
import * as MongoDB from "mongodb";
import { InconsistentUpdateParamsError } from "../mongo.errors";

describe("MongoQueryFactory", () => {
  let factory;

  beforeEach(() => {
    factory = new MongoQueryFactory({
      modelFieldMappings: {
        testField: { name: "dbTestField", type: "string" },
        testField2: { name: "dbTestField2", type: "string" },
      },
    });
  });

  describe("createFindQuery", () => {
    it("should create a find query with basic where conditions", () => {
      const params = {
        where: new Where().valueOf("testField").isEq("value"),
      };

      const result = factory.createFindQuery(params);
      expect(result.filter).toEqual({ dbTestField: { $eq: "value" } });
    });
  });

  describe("createCountQuery", () => {
    it("should create a count query with where conditions", () => {
      const params = {
        where: new Where().valueOf("testField").isEq("value"),
      };

      const result = factory.createCountQuery(params);
      expect(result.filter).toEqual({ dbTestField: { $eq: "value" } });
    });
  });

  describe("createUpdateQuery", () => {
    it("should handle UpdateOne method", () => {
      const updates = [{ testField: "newValue" }];
      const where = [new Where().valueOf("testField").isEq("oldValue")];
      const methods = [UpdateMethod.UpdateOne];

      const result = factory.createUpdateQuery(updates, where, methods);
      expect(result.filter).toEqual({
        dbTestField: { $eq: "oldValue" },
      });
      expect(result.update).toEqual({
        $set: { dbTestField: "newValue" },
      });
    });

    it("should handle multiple UpdateOne method", () => {
      const updates = [{ testField: "newValue" }, { testField2: "newValue2" }];
      const where = [
        new Where().valueOf("testField").isEq("oldValue"),
        new Where().valueOf("testField2").isEq("oldValue2"),
      ];
      const methods = [UpdateMethod.UpdateOne, UpdateMethod.UpdateOne];

      const result = factory.createUpdateQuery(updates, where, methods);
      expect(result[0].updateOne.filter).toEqual({
        dbTestField: { $eq: "oldValue" },
      });
      expect(result[0].updateOne.update).toEqual({
        $set: { dbTestField: "newValue" },
      });
      expect(result[1].updateOne.filter).toEqual({
        dbTestField2: { $eq: "oldValue2" },
      });
      expect(result[1].updateOne.update).toEqual({
        $set: { dbTestField2: "newValue2" },
      });
    });

    it("should throw error when update parameters count mismatch", () => {
      const updates = [{ testField: "newValue" }];
      const where = [
        new Where().valueOf("testField").isEq("oldValue"),
        new Where().valueOf("anotherField").isEq("value"),
      ];
      const methods = [
        UpdateMethod.UpdateOne,
        UpdateMethod.UpdateOne,
        UpdateMethod.UpdateOne,
      ];

      expect(() => {
        factory.createUpdateQuery(updates, where, methods);
      }).toThrowError(InconsistentUpdateParamsError);
    });
  });

  describe("createRemoveQuery", () => {
    it("should create a remove query based on where condition", () => {
      const params = {
        where: new Where().valueOf("testField").isEq("value"),
      };

      const result = factory.createRemoveQuery(params);
      expect(result.filter).toEqual({ dbTestField: { $eq: "value" } });
    });
  });

  describe("createAggregationQuery", () => {
    it("should create an aggregation query with group and match stages", () => {
      const params = {
        where: new Where().valueOf("testField").isEq("value"),
        groupBy: ["testField"],
        sum: "amount",
      };

      const result = factory.createAggregationQuery(params);
      expect(result.pipeline).toContainEqual({
        $match: { dbTestField: { $eq: "value" } },
      });
      expect(result.pipeline).toContainEqual({
        $group: {
          _id: { dbTestField: "$dbTestField" },
          totalSum: { $sum: "$amount" },
        },
      });
    });
  });
});
