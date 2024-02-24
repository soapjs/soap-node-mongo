import * as mongoDB from "mongodb";
import { MongoUtils } from "./mongo.utils";
import { MongoConfig } from "./mongo.config";

/**
 * Represents a MongoDB data source.
 */
export class MongoSource {
  /**
   * Creates a new MongoSource instance and establishes a connection to the MongoDB server.
   * @param {MongoConfig} config - The configuration object for the MongoDB connection.
   * @returns {Promise<MongoSource>} A promise that resolves to a new MongoSource instance.
   */
  public static async create(config: MongoConfig): Promise<MongoSource> {
    const client = new mongoDB.MongoClient(MongoUtils.buildMongoUrl(config));

    await client.connect();
    const database = client.db(config.database)

    return new MongoSource(client, database);
  }

  /**
   * Creates a new MongoSource instance.
   * @param {mongoDB.MongoClient} [client] - The MongoDB client instance.
   * @param {string} database - The MongoDB database name.
   */
  constructor(
    public readonly client: mongoDB.MongoClient,
    public readonly database: mongoDB.Db
  ) {}
}
