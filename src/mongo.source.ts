import {
  Source,
  SourceOptions,
  RemoveStats,
  UpdateStats,
  CollectionError,
  FindParams,
  CountParams,
  AggregationParams,
  RemoveParams,
  DatabaseSession,
  DatabaseSessionRegistry,
  DbQuery
} from "@soapjs/soap";
import * as mongoDb from "mongodb";

import { CollectionOptions } from "./mongo.types";
import { SoapMongo } from "./soap.mongo";
import { MongoUtils } from "./mongo.utils";
import { MongoModuleVersion } from "./mongo.config";
import { MongoQueryFactory } from "./mongo.query-factory";
import { MongoDatabaseSession } from "./mongo.transaction";
import { MongoFieldResolver } from "./mongo.field-resolver";
import { 
  MongoPerformanceMonitor, 
  MongoPerformanceMonitorImpl, 
  MongoPerformanceMetrics, 
  MongoPerformanceSummary,
  MongoPerformanceConfig,
  BlankPerformanceMonitor 
} from "./mongo.performance";
import { MongoWhereParser } from "./mongo.where.parser";

/**
 * Represents MongoDB data source.
 * @class
 * @implements {Source<T>}
 */
export class MongoSource<T> implements Source<T> {
  protected collection: mongoDb.Collection<T>;
  protected currentSession: mongoDb.ClientSession;
  protected moduleVersion: MongoModuleVersion;
  protected _queries: MongoQueryFactory<T>;
  protected _indexes: mongoDb.IndexDescription[];
  protected _fieldResolver: MongoFieldResolver<T>;
  protected _sessionRegistry: DatabaseSessionRegistry;
  protected _performanceMonitor: MongoPerformanceMonitor;

  /**
   * Constructs a new MongoCollection.
   * @constructor
   * @param {SoapMongo} mongo - The MongoDB data source.
   * @param {string} collectionName - The name of the collection.
   * @param {CollectionOptions} [options] - The collection options.
   */
  constructor(
    protected mongo: SoapMongo,
    public readonly collectionName: string,
    options?: CollectionOptions<T>
  ) {
    if (options) {
      this._indexes = options.indexes || [];
      this._queries =
        (options.queries as MongoQueryFactory<T>) ||
        new MongoQueryFactory<T>(options);
      this._fieldResolver = new MongoFieldResolver<T>(options.modelFieldMappings);
    } else {
      this._indexes = [];
      this._queries = new MongoQueryFactory();
      this._fieldResolver = new MongoFieldResolver<T>();
    }

    this.collection = this.mongo.database.collection<T>(collectionName);
    this.moduleVersion = MongoModuleVersion.create(
      MongoUtils.getMongoModuleVersion()
    );
    this._sessionRegistry = this.mongo.sessions;
    
    // Initialize performance monitor
    const performanceConfig: MongoPerformanceConfig = {
      enabled: options?.performanceMonitoring?.enabled ?? false,
      detailed: options?.performanceMonitoring?.detailed ?? true,
      slowQueryThreshold: options?.performanceMonitoring?.slowQueryThreshold ?? 1000,
      maxMetrics: options?.performanceMonitoring?.maxMetrics ?? 1000,
      metricsCollector: options?.performanceMonitoring?.metricsCollector
    };
    
    this._performanceMonitor = performanceConfig.enabled 
      ? new MongoPerformanceMonitorImpl(performanceConfig)
      : new BlankPerformanceMonitor();
    
    this.createIndexes();
  }

  /**
   * Gets the source options.
   */
  get options(): SourceOptions<T> {
    return {
      modelClass: undefined,
      modelFieldMappings: this._fieldResolver.getFieldMappings(),
      queries: this._queries,
    };
  }

  /**
   * Creates a new database session.
   */
  createSession(): DatabaseSession {
    return new MongoDatabaseSession(this.mongo.client);
  }

  /**
   * Creates the collection if it does not exist and ensures the required indexes.
   * @private
   * @returns {Promise<void>} - A promise that resolves when the collection and indexes are created.
   */
  private async createCollection(): Promise<void> {
    const {
      collectionName,
      mongo: { database },
      moduleVersion,
    } = this;

    if (moduleVersion.major >= 6) {
      await database.createCollection(collectionName);
    } else {
      // For older versions, the collection is created automatically
      await database.listCollections({ name: collectionName }).toArray();
    }
  }

  /**
   * Creates indexes for the collection.
   * @private
   * @returns {Promise<void>} - A promise that resolves when the indexes are created.
   */
  private async createIndexes(): Promise<void> {
    if (this._indexes.length === 0) {
      return;
    }

    try {
      await this.createCollection();
      await this.collection.createIndexes(this._indexes);
    } catch (error) {
      // Index creation errors are not critical, just log them
      console.warn(`Failed to create indexes for collection ${this.collectionName}:`, error);
    }
  }

  /**
   * Throws a collection error based on the provided error.
   * @private
   * @param {Error} error - The error to convert.
   * @param {Object} [options] - Additional options for error creation.
   */
  private throwCollectionError(
    error: Error,
    options?: {
      duplicatedIds: string[];
      insertedDocuments: T[];
      failedDocuments: T[];
    }
  ) {
    // Ensure the error has the correct name
    if (error.name === "MongoServerError" && (error as any).code === 11000) {
      const duplicateError = CollectionError.createDuplicateError(error, options);
      duplicateError.name = "CollectionError";
      (duplicateError as any).code = 11000; // Preserve the original error code
      throw duplicateError;
    }

    if (error.name === "MongoServerError" && (error as any).code === 121) {
      const invalidDataError = CollectionError.createInvalidDataError(error, options);
      invalidDataError.name = "CollectionError";
      (invalidDataError as any).code = 121; // Preserve the original error code
      throw invalidDataError;
    }

    const collectionError = CollectionError.createError(error, { message: error.message });
    collectionError.name = "CollectionError";
    // Preserve the original error code if it exists
    if ((error as any).code) {
      (collectionError as any).code = (error as any).code;
    }
    throw collectionError;
  }

  /**
   * Finds documents in the collection based on the provided query parameters.
   * @param {DbQuery} [query] - The query to execute.
   * @returns {Promise<T[]>} - A promise that resolves to an array of found documents.
   */
  public async find(query?: DbQuery): Promise<T[]> {
    const operationId = this._performanceMonitor.startOperation('find', this.collectionName, {
      hasQuery: !!query,
      hasWhere: !!(query as any)?.where
    });

    try {
      const mongoQuery = query ? this._queries.createFindQuery(query as FindParams) as any : { filter: {}, options: {} };
      const filter = mongoQuery?.filter || {};
      const options = mongoQuery?.options || {};
      
      const session = this.currentSession;
      if (session) {
        options.session = session;
      }
      
      const cursor = this.collection.find<T>(filter, options);
      const list = await cursor.toArray();
      
      this._performanceMonitor.endOperation(operationId, list.length);
      return list;
    } catch (error) {
      this._performanceMonitor.endOperation(operationId, undefined, error as Error);
      this.throwCollectionError(error);
    }
  }

  /**
   * Counts documents in the collection based on the provided query parameters.
   * @param {DbQuery} [query] - The query to execute.
   * @returns {Promise<number>} - A promise that resolves to the count of documents.
   */
  public async count(query?: DbQuery): Promise<number> {
    const operationId = this._performanceMonitor.startOperation('count', this.collectionName, {
      hasQuery: !!query,
      hasWhere: !!(query as any)?.where
    });

    try {
      const mongoQuery = query ? this._queries.createCountQuery(query as CountParams) as any : { filter: {}, options: {} };
      const filter = mongoQuery?.filter || {};
      const options = mongoQuery?.options || {};
      const session = this.currentSession;
      
      if (session) {
        options.session = session;
      }
      
      const count = await this.collection.countDocuments(filter, options);
      
      this._performanceMonitor.endOperation(operationId, count);
      return count;
    } catch (error) {
      this._performanceMonitor.endOperation(operationId, undefined, error as Error);
      this.throwCollectionError(error);
    }
  }

  /**
   * Executes an aggregation pipeline on the collection.
   * @param {DbQuery} query - The aggregation query to execute.
   * @returns {Promise<AggregationType[]>} - A promise that resolves to the result of the aggregation.
   */
  public async aggregate<AggregationType = T>(query: DbQuery): Promise<AggregationType[]> {
    const operationId = this._performanceMonitor.startOperation('aggregate', this.collectionName, {
      hasQuery: !!query,
      hasWhere: !!(query as any)?.where
    });

    try {
      const mongoQuery = this._queries.createAggregationQuery(query as AggregationParams) as any;

      const { pipeline, options } = mongoQuery;
      if (options) {
        options.allowDiskUse = true;
      }

      const session = this.currentSession;
      if (session) {
        options.session = session;
      }

      const cursor = this.collection.aggregate<AggregationType>(pipeline, options);
      const result = await cursor.toArray();
      
      this._performanceMonitor.endOperation(operationId, result.length);
      return result;
    } catch (error) {
      this._performanceMonitor.endOperation(operationId, undefined, error as Error);
      this.throwCollectionError(error);
    }
  }

  /**
   * Updates documents in the collection based on the provided query parameters.
   * @param {DbQuery} query - The update query to execute.
   * @returns {Promise<UpdateStats>} - A promise that resolves to the update statistics.
   */
  public async update(query: DbQuery): Promise<UpdateStats> {
    const operationId = this._performanceMonitor.startOperation('update', this.collectionName, {
      hasWhere: !!(query as any)?.where
    });

    try {
      // Handle different query formats
      let filter: mongoDb.Filter<mongoDb.Document> = {};
      let update: mongoDb.UpdateFilter<mongoDb.Document> = {};
      const options: mongoDb.UpdateOptions = {};

      if (query && typeof query === 'object') {
        // Handle format: { where: {...}, update: {...} }
        if ('where' in query && 'update' in query) {
          // Use the whereParser from MongoQueryFactory
          const whereParser = new MongoWhereParser();
          filter = whereParser.parse((query as any).where);
          update = { $set: (query as any).update };
        } else if ('updates' in query && 'where' in query && 'methods' in query) {
          // Handle format: { updates: [...], where: [...], methods: [...] }
          const mongoQuery = this._queries.createUpdateQuery(
            (query as any).updates || [],
            (query as any).where || [],
            (query as any).methods || []
          ) as any;
          filter = mongoQuery.filter || {};
          update = mongoQuery.update || {};
          Object.assign(options, mongoQuery.options || {});
        }
      }

      const session = this.currentSession;
      if (session) {
        options.session = session;
      }

      // Use updateMany by default for bulk operations
      const updateResult = await this.collection.updateMany(filter, update as any, options);

      const { matchedCount, modifiedCount, upsertedCount, upsertedId } = updateResult;

      const result = {
        status: matchedCount > 0 ? "success" : "failure",
        modifiedCount: modifiedCount,
        upsertedCount: upsertedCount,
        upsertedIds: upsertedId ? [upsertedId] : [],
      };

      this._performanceMonitor.endOperation(operationId, modifiedCount);
      return result;
    } catch (error) {
      this._performanceMonitor.endOperation(operationId, undefined, error as Error);
      this.throwCollectionError(error);
    }
  }

  /**
   * Inserts documents into the collection.
   * @param {DbQuery} query - The documents to insert.
   * @returns {Promise<T[]>} - A promise that resolves to the inserted documents.
   */
  public async insert(query: DbQuery): Promise<T[]> {
    const operationId = this._performanceMonitor.startOperation('insert', this.collectionName, {
      hasQuery: !!query,
      isArray: Array.isArray(query)
    });

    const options: mongoDb.BulkWriteOptions = { ordered: true };
    const documents = [];
    try {
      if (Array.isArray(query)) {
        documents.push(...query);
      } else if (query && typeof query === 'object') {
        // Handle different query formats
        if ('documents' in query && Array.isArray((query as any).documents)) {
          documents.push(...(query as any).documents);
        } else if (query !== null) {
          // If query is a single document
          documents.push(query as T);
        }
        
        if ((query as any).options) {
          Object.assign(options, (query as any).options);
        }
      }

      if (documents.length === 0) {
        throw new Error('No documents to insert');
      }

      if (this.currentSession) {
        options.session = this.currentSession;
      }

      const insertResult = await this.collection.insertMany(documents, options);
      const insertedDocuments = documents.map((document, index) => ({
        _id: insertResult.insertedIds[index],
        ...document,
      }));

      this._performanceMonitor.endOperation(operationId, insertedDocuments.length);
      return insertedDocuments as T[];
    } catch (error) {
      const insertedDocuments = [];
      const failedDocuments = [];
      const duplicatedIds = MongoUtils.getDuplicatedDocumentIds(error);
      if (error.writeErrors) {
        if (options.ordered && error.writeErrors.length === 1) {
          const failedIndex = error.writeErrors[0].index;
          failedDocuments.push(documents[failedIndex]);
          insertedDocuments.push(...documents.slice(0, failedIndex));
        } else {
          failedDocuments.push(...documents);
        }
      }

      this._performanceMonitor.endOperation(operationId, undefined, error as Error);
      this.throwCollectionError(error, {
        duplicatedIds,
        insertedDocuments,
        failedDocuments,
      });
    }
  }

  /**
   * Removes documents from the collection based on the provided query parameters.
   * @param {DbQuery} query - The remove query to execute.
   * @returns {Promise<RemoveStats>} - A promise that resolves to the remove statistics.
   */
  public async remove(query: DbQuery): Promise<RemoveStats> {
    const operationId = this._performanceMonitor.startOperation('remove', this.collectionName, {
      hasQuery: !!query,
      hasWhere: !!(query as any)?.where
    });

    try {
      const mongoQuery = this._queries.createRemoveQuery(query as RemoveParams) as any;
      const filter = mongoQuery?.filter || {};
      const options = mongoQuery?.options || {};

      const session = this.currentSession;
      if (session) {
        options.session = session;
      }

      const deleteResult = await this.collection.deleteMany(filter, options);
      const { deletedCount } = deleteResult;

      const result = {
        status: deletedCount > 0 ? "success" : "failure",
        deletedCount: deletedCount,
      };

      this._performanceMonitor.endOperation(operationId, deletedCount);
      return result;
    } catch (error) {
      this._performanceMonitor.endOperation(operationId, undefined, error as Error);
      this.throwCollectionError(error);
    }
  }

  /**
   * Starts a session on the current session.
   * @param {mongoDb.ClientSessionOptions} [options] - The session options.
   * @returns {Promise<mongoDb.ClientSession>} A promise that resolves to the session.
   */
  public async startSession(
    options?: mongoDb.ClientSessionOptions
  ): Promise<mongoDb.ClientSession> {
    if (!this.currentSession) {
      this.currentSession = this.mongo.client.startSession(options);
    }
    return this.currentSession;
  }

  /**
   * Ends a session on the current session.
   * @returns {Promise<void>} A promise that resolves when the session ends.
   */
  public async endSession(): Promise<void> {
    if (this.currentSession) {
      await this.currentSession.endSession();
      this.currentSession = null;
    }
  }

  /**
   * Starts a transaction on the current session.
   * @param {mongoDb.TransactionOptions} [options] - The transaction options.
   * @returns {Promise<void>} A promise that resolves when the transaction starts.
   */
  public async startTransaction(
    options?: mongoDb.TransactionOptions
  ): Promise<void> {
    if (!this.currentSession) {
      await this.startSession();
    }
    await this.currentSession.startTransaction(options);
  }

  /**
   * Commits the current transaction.
   * @returns {Promise<void>} A promise that resolves when the transaction commits.
   */
  public async commitTransaction(): Promise<void> {
    if (this.currentSession) {
      await this.currentSession.commitTransaction();
    }
  }

  /**
   * Rolls back the current transaction.
   * @returns {Promise<void>} A promise that resolves when the transaction rollbacks.
   */
  public async rollbackTransaction(): Promise<void> {
    if (this.currentSession) {
      await this.currentSession.abortTransaction();
    }
  }

  /**
   * Gets performance metrics for this source.
   * @returns {MongoPerformanceMetrics[]} Array of performance metrics.
   */
  public getPerformanceMetrics(): MongoPerformanceMetrics[] {
    return this._performanceMonitor.getMetrics();
  }

  /**
   * Gets performance summary for this source.
   * @returns {MongoPerformanceSummary} Performance summary statistics.
   */
  public getPerformanceSummary(): MongoPerformanceSummary {
    return this._performanceMonitor.getSummary();
  }

  /**
   * Gets slow queries for this source.
   * @returns {MongoPerformanceMetrics[]} Array of slow queries.
   */
  public getSlowQueries(): MongoPerformanceMetrics[] {
    return this._performanceMonitor.getSlowQueries();
  }

  /**
   * Clears performance metrics for this source.
   */
  public clearPerformanceMetrics(): void {
    this._performanceMonitor.clearMetrics();
  }
}
