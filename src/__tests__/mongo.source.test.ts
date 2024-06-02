import * as mongoDB from "mongodb";
import { MongoSource } from "../mongo.source";
import { MongoUtils } from "../mongo.utils";
import { MongoQueryFactory } from "../mongo.query-factory";
import { MongoConfig } from "../mongo.config";
import { SoapMongo } from "../soap.mongo";
import { UpdateMethod, Where } from "@soapjs/soap";

jest.mock("mongodb");
jest.mock("../mongo.utils", () => ({
  ...jest.requireActual("../mongo.utils"),
  getMongoModuleVersion: jest.fn(() => "4.9.0"),
}));
jest.mock("../mongo.query-factory");
jest.mock("../soap.mongo");

describe("MongoSource", () => {
  let client;
  let db;
  let collection;
  let queryFactory;
  let config;
  let mongoSource;
  let mongoSoap;
  beforeEach(() => {
    db = {
      collection: jest.fn(),
      createCollection: jest.fn().mockResolvedValue(true),
    };
    client = {
      database: db,
    };
    collection = {
      find: jest.fn(),
      insertMany: jest.fn(),
      deleteMany: jest.fn(),
      updateOne: jest.fn(),
      updateMany: jest.fn(),
      countDocuments: jest.fn(),
      aggregate: jest.fn(),
      bulkWrite: jest.fn(),
      createIndexes: jest.fn().mockResolvedValue([]),
      listIndexes: jest
        .fn()
        .mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
    };
    mongoSoap = { client, database: db };
    db.collection.mockReturnValue(collection);
    queryFactory = new MongoQueryFactory();
    config = { database: "testdb" };

    mongoSource = new MongoSource(mongoSoap, "testCollection", {
      queries: queryFactory,
    });
  });

  describe("constructor", () => {
    it("should create an instance with the correct properties", () => {
      expect(mongoSource.collection).toBe(collection);
      expect(mongoSource.client).toBe(mongoSoap);
    });
  });

  describe("find", () => {
    it("should execute find query correctly", async () => {
      const findParams = { filter: {}, options: {} };
      const docs = [{ _id: "1", name: "John Doe" }];
      collection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(docs),
      });

      const result = await mongoSource.find(findParams);
      expect(collection.find).toHaveBeenCalledWith({}, {});
      expect(result).toEqual(docs);
    });
  });

  describe("insert", () => {
    it("should insert documents correctly", async () => {
      const docs = [{ name: "John Doe" }];
      collection.insertMany.mockResolvedValue({
        insertedCount: 1,
        insertedIds: { 0: "1" },
      });

      const result = await mongoSource.insert(docs);
      expect(collection.insertMany).toHaveBeenCalledWith(docs, {
        ordered: true,
      });
      expect(result).toHaveLength(1);
    });
  });

  describe("remove", () => {
    it("should remove documents correctly", async () => {
      const removeParams = {
        where: new Where().valueOf("key").isIn([1, 2, 3, 4]),
      };
      queryFactory.createRemoveQuery.mockImplementation(() => ({ filter: {} }));
      collection.deleteMany.mockResolvedValue({
        acknowledged: true,
        deletedCount: 1,
      });

      const result = await mongoSource.remove(removeParams);
      expect(collection.deleteMany).toHaveBeenCalledWith({});
      expect(result.deletedCount).toBe(1);
    });
  });

  describe("update", () => {
    it("should update documents correctly", async () => {
      const updateParams = {
        filter: {},
        update: { $set: { name: "Jane Doe" } },
        method: UpdateMethod.UpdateOne,
      };
      collection.updateOne.mockResolvedValue({
        matchedCount: 1,
        modifiedCount: 1,
        upsertedId: "1",
      });

      const result = await mongoSource.update(updateParams);
      expect(collection.updateOne).toHaveBeenCalledWith(
        {},
        { $set: { name: "Jane Doe" } },
        undefined
      );
      expect(result.modifiedCount).toBe(1);
    });
  });

  describe("aggregate", () => {
    it("should perform aggregation correctly", async () => {
      const aggParams = { pipeline: [], options: {} };
      const results = [{ _id: "1", total: 100 }];
      queryFactory.createAggregationQuery.mockImplementation(() => aggParams);
      collection.aggregate.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(results),
      });
      const result = await mongoSource.aggregate(aggParams);
      expect(collection.aggregate).toHaveBeenCalledWith([], {
        allowDiskUse: true,
      });
      expect(result).toEqual(results);
    });
  });
});
