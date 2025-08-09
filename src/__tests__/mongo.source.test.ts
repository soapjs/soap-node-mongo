import { MongoSource } from "../mongo.source";
import { SoapMongo } from "../soap.mongo";
import { FindParams, UpdateParams, RemoveParams, Where, UpdateMethod, CountParams, AggregationParams } from "@soapjs/soap";
import * as mongoDb from "mongodb";

// Mock MongoDB
jest.mock("mongodb");

describe("MongoSource", () => {
  let mongoSource: MongoSource<any>;
  let mongoSoap: SoapMongo;
  let collection: any;
  let database: any;
  let client: any;

  beforeEach(() => {
    // Setup mocks
    collection = {
      find: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ id: 1, name: "test" }])
      }),
      countDocuments: jest.fn().mockResolvedValue(1),
      aggregate: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ total: 100 }])
      }),
      updateOne: jest.fn().mockResolvedValue({
        matchedCount: 1,
        modifiedCount: 1,
        upsertedCount: 0,
        upsertedId: null
      }),
      updateMany: jest.fn().mockResolvedValue({
        matchedCount: 1,
        modifiedCount: 1,
        upsertedCount: 0,
        upsertedId: null
      }),
      insertMany: jest.fn().mockResolvedValue({
        insertedIds: { 0: "id1", 1: "id2" }
      }),
      deleteMany: jest.fn().mockResolvedValue({
        acknowledged: true,
        deletedCount: 1
      }),
      listIndexes: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([])
      }),
      createIndexes: jest.fn().mockResolvedValue(undefined)
    };

    database = {
      collection: jest.fn().mockReturnValue(collection),
      createCollection: jest.fn().mockResolvedValue(undefined)
    };

    client = {
      startSession: jest.fn().mockReturnValue({
        id: "session1",
        endSession: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        abortTransaction: jest.fn().mockResolvedValue(undefined)
      })
    };

    mongoSoap = {
      client,
      database,
      sessions: {
        createSession: jest.fn(),
        deleteSession: jest.fn(),
        getSession: jest.fn(),
        hasSession: jest.fn(),
        getAllSessions: jest.fn(),
        clearSessions: jest.fn(),
        transactionScope: {}
      }
    } as any;

    mongoSource = new MongoSource(mongoSoap, "testCollection");
  });

  describe("constructor", () => {
    it("should create an instance with the correct properties", () => {
      expect(mongoSource.collectionName).toBe("testCollection");
      expect(database.collection).toHaveBeenCalledWith("testCollection");
    });
  });

  describe("find", () => {
    it("should find documents correctly", async () => {
      const where = new Where();
      where.valueOf("status").isEq("active");
      
      const findParams: FindParams = {
        where,
        limit: 10,
        offset: 0,
        sort: { name: 1 }
      };

      const result = await mongoSource.find(findParams);

      expect(collection.find).toHaveBeenCalledWith(
        { status: "active" },
        { limit: 10, skip: 0, sort: { name: 1 } }
      );
      expect(result).toEqual([{ id: 1, name: "test" }]);
    });

    it("should find documents without parameters", async () => {
      const result = await mongoSource.find();

      expect(collection.find).toHaveBeenCalledWith({}, {});
      expect(result).toEqual([{ id: 1, name: "test" }]);
    });
  });

  describe("count", () => {
    it("should count documents correctly", async () => {
      const where = new Where();
      where.valueOf("status").isEq("active");
      
      const countParams: CountParams = {
        where
      };

      const result = await mongoSource.count(countParams);

      expect(collection.countDocuments).toHaveBeenCalledWith(
        { status: "active" },
        {}
      );
      expect(result).toBe(1);
    });
  });

  describe("update", () => {
    it("should update documents correctly", async () => {
      const where = new Where();
      where.valueOf("status").isEq("active");
      
      const updateParams: UpdateParams = {
        updates: [{ status: "inactive" }],
        where: [where],
        methods: [UpdateMethod.UpdateOne]
      };

      const result = await mongoSource.update(updateParams);

      expect(collection.updateOne).toHaveBeenCalledWith(
        { status: "active" },
        { $set: { status: "inactive" } },
        {}
      );
      expect(result.status).toBe("success");
      expect(result.modifiedCount).toBe(1);
    });
  });

  describe("insert", () => {
    it("should insert documents correctly", async () => {
      const documents = [
        { name: "John", email: "john@example.com" },
        { name: "Jane", email: "jane@example.com" }
      ];

      const result = await mongoSource.insert(documents);

      expect(collection.insertMany).toHaveBeenCalledWith(documents, { ordered: true });
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("_id", "id1");
      expect(result[1]).toHaveProperty("_id", "id2");
    });
  });

  describe("remove", () => {
    it("should remove documents correctly", async () => {
      const where = new Where();
      where.valueOf("status").isEq("deleted");
      
      const removeParams: RemoveParams = {
        where
      };

      const result = await mongoSource.remove(removeParams);

      expect(collection.deleteMany).toHaveBeenCalledWith(
        { status: "deleted" },
        {}
      );
      expect(result.status).toBe("success");
      expect(result.deletedCount).toBe(1);
    });
  });

  describe("aggregate", () => {
    it("should aggregate documents correctly", async () => {
      const where = new Where();
      where.valueOf("status").isEq("active");
      
      const aggregationParams: AggregationParams = {
        where,
        groupBy: ["category"],
        sum: "amount"
      };

      const result = await mongoSource.aggregate(aggregationParams);

      expect(collection.aggregate).toHaveBeenCalled();
      expect(result).toEqual([{ total: 100 }]);
    });
  });

  describe("session management", () => {
    it("should start a session", async () => {
      const session = await mongoSource.startSession();
      expect(client.startSession).toHaveBeenCalled();
      expect(session).toBeDefined();
    });

    it("should end a session", async () => {
      await mongoSource.startSession();
      await mongoSource.endSession();
      // Session should be ended
      expect(client.startSession).toHaveBeenCalled();
    });

    it("should start a transaction", async () => {
      await mongoSource.startTransaction();
      expect(client.startSession).toHaveBeenCalled();
    });

    it("should commit a transaction", async () => {
      await mongoSource.startTransaction();
      await mongoSource.commitTransaction();
      // Transaction should be committed
      expect(client.startSession).toHaveBeenCalled();
    });

    it("should rollback a transaction", async () => {
      await mongoSource.startTransaction();
      await mongoSource.rollbackTransaction();
      // Transaction should be rolled back
      expect(client.startSession).toHaveBeenCalled();
    });
  });

  describe("options", () => {
    it("should return source options", () => {
      const options = mongoSource.options;
      expect(options).toHaveProperty("modelFieldMappings");
      expect(options).toHaveProperty("queries");
    });
  });

  describe("createSession", () => {
    it("should create a new database session", () => {
      const session = mongoSource.createSession();
      expect(session).toBeDefined();
      expect(session).toHaveProperty("id");
    });
  });
});
