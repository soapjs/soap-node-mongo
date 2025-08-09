import { ConfigVars } from "@soapjs/soap";
import * as mongoDb from "mongodb";

/**
 * Connection pool configuration for MongoDB.
 */
export interface MongoConnectionPoolConfig {
  /** Maximum number of connections in the pool */
  maxPoolSize?: number;
  /** Minimum number of connections in the pool */
  minPoolSize?: number;
  /** Maximum number of connections that can be created per second */
  maxConnecting?: number;
  /** Maximum time a connection can remain idle in the pool */
  maxIdleTimeMS?: number;
  /** Maximum time to wait for a connection from the pool */
  waitQueueTimeoutMS?: number;
  /** Maximum time to wait for a connection to be established */
  connectTimeoutMS?: number;
  /** Maximum time to wait for a socket timeout */
  socketTimeoutMS?: number;
  /** Maximum time to wait for a server selection */
  serverSelectionTimeoutMS?: number;
  /** Heartbeat frequency */
  heartbeatFrequencyMS?: number;
  /** Retry writes */
  retryWrites?: boolean;
  /** Retry reads */
  retryReads?: boolean;
  /** Write concern */
  writeConcern?: mongoDb.WriteConcern;
  /** Read preference */
  readPreference?: mongoDb.ReadPreference;
  /** Read concern */
  readConcern?: mongoDb.ReadConcern;
}

/**
 * MongoDB configuration with advanced connection pool settings.
 */
export class MongoConfig {
  /**
   * Builds a MongoDB configuration object based on the provided configuration variables.
   *
   * @param {ConfigVars} configVars - The configuration variables object.
   * @param {string} [prefix=''] - The prefix to prepend to the configuration variable names.
   * @returns {MongoConfig} The MongoDB configuration object.
   */
  static create(configVars: ConfigVars, prefix = ""): MongoConfig {
    const p = prefix
      ? prefix.endsWith("_")
        ? prefix.toUpperCase()
        : prefix.toUpperCase() + "_"
      : "";

    return new MongoConfig(
      configVars.getStringEnv(`${p}MONGO_DB_NAME`),
      configVars.getArrayEnv(`${p}MONGO_HOSTS`),
      configVars.getArrayEnv(`${p}MONGO_PORTS`),
      configVars.getStringEnv(`${p}MONGO_USER`),
      configVars.getStringEnv(`${p}MONGO_PASSWORD`),
      configVars.getStringEnv(`${p}MONGO_AUTH_MECHANISM`),
      configVars.getStringEnv(`${p}MONGO_AUTH_SOURCE`),
      configVars.getBooleanEnv(`${p}MONGO_SSL`),
      configVars.getStringEnv(`${p}MONGO_REPLICA_SET`),
      configVars.getBooleanEnv(`${p}MONGO_SRV`),
      {
        maxPoolSize: configVars.getNumberEnv(`${p}MONGO_MAX_POOL_SIZE`) || 10,
        minPoolSize: configVars.getNumberEnv(`${p}MONGO_MIN_POOL_SIZE`) || 0,
        maxConnecting: configVars.getNumberEnv(`${p}MONGO_MAX_CONNECTING`) || 2,
        maxIdleTimeMS: configVars.getNumberEnv(`${p}MONGO_MAX_IDLE_TIME_MS`) || 30000,
        waitQueueTimeoutMS: configVars.getNumberEnv(`${p}MONGO_WAIT_QUEUE_TIMEOUT_MS`) || 30000,
        connectTimeoutMS: configVars.getNumberEnv(`${p}MONGO_CONNECT_TIMEOUT_MS`) || 30000,
        socketTimeoutMS: configVars.getNumberEnv(`${p}MONGO_SOCKET_TIMEOUT_MS`) || 30000,
        serverSelectionTimeoutMS: configVars.getNumberEnv(`${p}MONGO_SERVER_SELECTION_TIMEOUT_MS`) || 30000,
        heartbeatFrequencyMS: configVars.getNumberEnv(`${p}MONGO_HEARTBEAT_FREQUENCY_MS`) || 10000,
        retryWrites: configVars.getBooleanEnv(`${p}MONGO_RETRY_WRITES`) ?? true,
        retryReads: configVars.getBooleanEnv(`${p}MONGO_RETRY_READS`) ?? true
      }
    );
  }

  constructor(
    public readonly database: string,
    public readonly hosts: string[],
    public readonly ports?: (number | string)[],
    public readonly user?: string,
    public readonly password?: string,
    public readonly authMechanism?: string,
    public readonly authSource?: string,
    public readonly ssl?: boolean,
    public readonly replicaSet?: string,
    public readonly srv?: boolean,
    public readonly connectionPool?: MongoConnectionPoolConfig
  ) {}

  /**
   * Gets MongoDB client options with connection pool configuration.
   */
  getClientOptions(): mongoDb.MongoClientOptions {
    const options: mongoDb.MongoClientOptions = {
      maxPoolSize: this.connectionPool?.maxPoolSize || 10,
      minPoolSize: this.connectionPool?.minPoolSize || 0,
      maxConnecting: this.connectionPool?.maxConnecting || 2,
      maxIdleTimeMS: this.connectionPool?.maxIdleTimeMS || 30000,
      waitQueueTimeoutMS: this.connectionPool?.waitQueueTimeoutMS || 30000,
      connectTimeoutMS: this.connectionPool?.connectTimeoutMS || 30000,
      socketTimeoutMS: this.connectionPool?.socketTimeoutMS || 30000,
      serverSelectionTimeoutMS: this.connectionPool?.serverSelectionTimeoutMS || 30000,
      heartbeatFrequencyMS: this.connectionPool?.heartbeatFrequencyMS || 10000,
      retryWrites: this.connectionPool?.retryWrites ?? true,
      retryReads: this.connectionPool?.retryReads ?? true
    };

    if (this.connectionPool?.writeConcern) {
      options.writeConcern = this.connectionPool.writeConcern;
    }

    if (this.connectionPool?.readPreference) {
      options.readPreference = this.connectionPool.readPreference;
    }

    if (this.connectionPool?.readConcern) {
      options.readConcern = this.connectionPool.readConcern;
    }

    return options;
  }
}

export class MongoModuleVersion {
  static create(version: string) {
    const [major, minor, patch] = version.split(".");
    return new MongoModuleVersion(version, +major, +minor, +patch);
  }

  private constructor(
    private version: string,
    public readonly major: number,
    public readonly minor: number,
    public readonly patch: number
  ) {}

  toString() {
    return this.version;
  }
}
