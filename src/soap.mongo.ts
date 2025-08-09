import * as mongoDB from "mongodb";
import { MongoUtils } from "./mongo.utils";
import { MongoConfig } from "./mongo.config";
import { MongoSessionManager } from "./mongo.session-manager";

/**
 * Represents a MongoDB data source.
 */
export class SoapMongo {
  /**
   * Creates a new MongoSource instance and establishes a connection to the MongoDB server.
   * @param {MongoConfig} config - The configuration object for the MongoDB connection.
   * @returns {Promise<SoapMongo>} A promise that resolves to a new MongoSource instance.
   */
  public static async create(config: MongoConfig): Promise<SoapMongo> {
    const url = MongoUtils.buildMongoUrl(config);
    const clientOptions = config.getClientOptions();
    
    const client = new mongoDB.MongoClient(url, clientOptions);

    await client.connect();
    const database = client.db(config.database);

    return new SoapMongo(client, database);
  }

  private _sessions: MongoSessionManager;

  /**
   * Creates a new MongoSource instance.
   * @param {mongoDB.MongoClient} [client] - The MongoDB client instance.
   * @param {string} database - The MongoDB database name.
   */
  constructor(
    public readonly client: mongoDB.MongoClient,
    public readonly database: mongoDB.Db
  ) {
    this._sessions = new MongoSessionManager(client);
  }

  get sessions(): MongoSessionManager {
    return this._sessions;
  }

  /**
   * Gets connection pool statistics.
   * @returns {Promise<any>} Connection pool statistics.
   */
  async getConnectionPoolStats(): Promise<any> {
    return await this.client.db().admin().command({ connectionPoolStats: 1 });
  }

  /**
   * Gets server status information.
   * @returns {Promise<any>} Server status information.
   */
  async getServerStatus(): Promise<any> {
    return await this.client.db().admin().command({ serverStatus: 1 });
  }
}
