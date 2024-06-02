import { MongoUtils } from "../mongo.utils";
import { MongoError } from "mongodb";

describe("MongoUtils", () => {
  describe("buildMongoUrl", () => {
    it("should build a correct MongoDB URL from a simple config", () => {
      const config: any = {
        hosts: ["localhost"],
        ports: ["27017"],
        database: "testdb",
        user: "user",
        password: "pass",
        authSource: "admin",
        srv: false,
      };
      const url = MongoUtils.buildMongoUrl(config);
      expect(url).toBe(
        "mongodb://user:pass@localhost:27017/?authMechanism=DEFAULT&authSource=admin"
      );
    });
  });

  describe("containsSpecialKeys", () => {
    it("should return true if special MongoDB update keys are present", () => {
      const data = { $set: { name: "John" } };
      expect(MongoUtils.containsSpecialKeys(data)).toBeTruthy();
    });

    it("should return false if no special keys are present", () => {
      const data = { name: "John" };
      expect(MongoUtils.containsSpecialKeys(data)).toBeFalsy();
    });
  });

  describe("isMongoConfig", () => {
    it("should return true if value conforms to MongoConfig type", () => {
      const config = { hosts: ["localhost"], database: "testdb" };
      expect(MongoUtils.isMongoConfig(config)).toBeTruthy();
    });

    it("should return false if value does not conform", () => {
      const config = { database: "testdb" };
      expect(MongoUtils.isMongoConfig(config)).toBeFalsy();
    });
  });

  describe("isDuplicateError", () => {
    it("should recognize a MongoDB duplicate error", () => {
      const error = new MongoError("Duplicate key error");
      error.code = 11000;
      expect(MongoUtils.isDuplicateError(error)).toBeTruthy();
    });

    it("should not falsely identify non-duplicate errors", () => {
      const error = new MongoError("Some other error");
      expect(MongoUtils.isDuplicateError(error)).toBeFalsy();
    });
  });

  describe("getDuplicatedDocumentIds", () => {
    it("should extract duplicated document IDs from error message", () => {
      const error = new Error(
        'E11000 duplicate key error collection: test.coll index: _id_ dup key: { : "507f191e810c19729de860ea" }'
      );
      expect(MongoUtils.getDuplicatedDocumentIds(error)).toEqual([
        "507f191e810c19729de860ea",
      ]);
    });

    it("should return an empty array if no IDs are present", () => {
      const error = new Error("No duplicate key error here");
      expect(MongoUtils.getDuplicatedDocumentIds(error)).toEqual([]);
    });
  });

  describe("isInvalidDataError", () => {
    it("should recognize a MongoDB invalid data error", () => {
      const error = new MongoError("Document failed validation");
      error.code = 121;
      expect(MongoUtils.isInvalidDataError(error)).toBeTruthy();
    });

    it("should not falsely identify other types of errors", () => {
      const error = new MongoError("An error occurred");
      expect(MongoUtils.isInvalidDataError(error)).toBeFalsy();
    });
  });

  describe("isBulkUpdate", () => {
    it("should confirm a bulk update with valid operations", () => {
      const operations: any[] = [
        {
          updateOne: { filter: { _id: 1 }, update: { $set: { name: "John" } } },
        },
      ];
      expect(MongoUtils.isBulkUpdate(operations)).toBeTruthy();
    });

    it("should reject non-bulk updates", () => {
      const operations = [{ insertOne: { document: { name: "John" } } }];
      expect(MongoUtils.isBulkUpdate(operations)).toBeFalsy();
    });
  });

  describe("buildMongoConfig", () => {
    it("should build a MongoConfig from ConfigVars", () => {
      const configVars = {
        getStringEnv: jest
          .fn()
          .mockImplementation((key) =>
            key === "MONGO_DB_NAME" ? "mydb" : null
          ),
        getArrayEnv: jest
          .fn()
          .mockImplementation((key) =>
            key === "MONGO_HOSTS" ? ["localhost"] : []
          ),
        getBooleanEnv: jest
          .fn()
          .mockImplementation((key) => (key === "MONGO_SSL" ? true : false)),
      };
      const config = MongoUtils.buildMongoConfig(configVars as any);
      expect(config.database).toBe("mydb");
      expect(config.hosts).toEqual(["localhost"]);
      expect(config.ssl).toBeTruthy();
    });
  });

  describe("getMongoModuleVersion", () => {
    it("should return the MongoDB module version", () => {
      expect(MongoUtils.getMongoModuleVersion()).toMatch(/^\d+\.\d+\.\d+$/); // Assuming a semantic versioning format
    });
  });
});
