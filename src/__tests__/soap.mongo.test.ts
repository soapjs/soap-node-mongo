import * as mongoDB from "mongodb";
import { MongoUtils } from "../mongo.utils";
import { SoapMongo } from "../soap.mongo";

jest.mock("mongodb", () => {
  const actualMongoDB = jest.requireActual("mongodb");
  return {
    ...actualMongoDB,
    MongoClient: jest.fn().mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      db: jest.fn().mockReturnValue({ databaseName: "testdbInstance" }), // Ensure `db` is a function
    })),
  };
});

describe("SoapMongo", () => {
  const config = {
    database: "testdb",
    hosts: ["localhost"],
    ports: [27017],
    user: "user",
    password: "pass",
    authSource: "admin",
  };

  it("should create a new SoapMongo instance and connect to the database", async () => {
    const url = "mongodb://user:pass@localhost:27017/?authSource=admin";

    jest.spyOn(MongoUtils, "buildMongoUrl").mockReturnValue(url);

    const soapMongo = await SoapMongo.create(config);

    expect(MongoUtils.buildMongoUrl).toHaveBeenCalledWith(config);
    expect(mongoDB.MongoClient).toHaveBeenCalledWith(url);
    expect(soapMongo.client.connect).toHaveBeenCalled();
    expect(soapMongo.client.db).toHaveBeenCalledWith(config.database);
    expect(soapMongo.database).toBeDefined();
    expect(soapMongo.database.databaseName).toBe("testdbInstance");
  });
});
