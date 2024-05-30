import {
  OperationStatus,
  RemoveStats,
  UpdateMethod,
  UpdateStats,
  Source,
  CollectionError,
  FindParams,
  CountParams,
  AggregationParams,
  UpdateParams,
  RemoveParams,
} from "@soapjs/soap";
import * as mongoDb from "mongodb";

import {
  BulkUpdateOperationsError,
  PendingSessionError,
  SessionError,
} from "./mongo.errors";
import {
  CollectionOptions,
  MongoAggregateParams,
  MongoCountQueryParams,
  MongoDeleteQueryParams,
  MongoFindQueryParams,
  MongoInsertQueryParams,
  MongoUpdateQueryParams,
} from "./mongo.types";
import { SoapMongo } from "./soap.mongo";
import { MongoUtils } from "./mongo.utils";
import { MongoModuleVersion } from "./mongo.config";
import { MongoQueryFactory } from "./mongo.query-factory";

/**
 * Represents MongoDB data source.
 * @class
 * @implements {Source<T>}
 */
export class MongoSource<T> implements Source<T> {
  protected collection: mongoDb.Collection<T>;
  protected currentSession: mongoDb.ClientSession;
  protected moduleVersion: MongoModuleVersion;

  /**
   * Constructs a new MongoCollection.
   * @constructor
   * @param {SoapMongo} client - The MongoDB data source.
   * @param {string} collectionName - The name of the collection.
   * @param {CollectionOptions} [options] - The collection options.
   */
  constructor(
    protected client: SoapMongo,
    public readonly collectionName: string,
    public readonly queries: MongoQueryFactory = new MongoQueryFactory(),
    protected options?: CollectionOptions
  ) {
    this.collection = this.client.database.collection<T>(collectionName);
    this.moduleVersion = MongoModuleVersion.create(
      MongoUtils.getMongoModuleVersion()
    );
    this.createIndexes();
  }

  /**
   * Creates the collection if it does not exist and ensures the required indexes.
   * @private
   * @returns {Promise<void>} - A promise that resolves when the collection and indexes are created.
   */
  private async createCollection(): Promise<void> {
    const {
      collectionName,
      client: { database },
      moduleVersion,
    } = this;

    if (moduleVersion.major >= 6) {
      await database.createCollection(collectionName);
    } else {
      return new Promise((resolve, reject) => {
        (database.createCollection as any)(collectionName, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  /**
   * Creates the required indexes for the collection if they do not already exist.
   * @private
   * @returns {Promise<void>} - A promise that resolves when the indexes are created.
   */
  private async createIndexes(): Promise<void> {
    try {
      if (this.options?.indexes.length > 0) {
        const {
          options: { indexes },
        } = this;

        await this.createCollection();

        const cursor = this.collection.listIndexes();
        const currentIndexes = await cursor.toArray();

        if (currentIndexes.length < 2) {
          await this.collection.createIndexes(indexes);
        }
      }
    } catch (error) {
      console.log(this.collectionName, error.message);
    }
  }

  /**
   * Throws a CollectionError based on the provided error.
   * @private
   * @param {Error} error - The original error.
   * @param options
   * @returns {void}
   * @throws {CollectionError} - The CollectionError with the appropriate error type.
   */
  private throwCollectionError(
    error: Error,
    options?: {
      duplicatedIds: string[];
      insertedDocuments: T[];
      failedDocuments: T[];
    }
  ) {
    if (MongoUtils.isDuplicateError(error)) {
      throw CollectionError.createDuplicateError(error, options);
    }

    if (MongoUtils.isInvalidDataError(error)) {
      throw CollectionError.createInvalidDataError(error, options);
    }

    throw CollectionError.createError(error);
  }

  /**
   * Finds documents in the collection based on the provided query parameters.
   * @param {FindParams | MongoFindQueryParams<T>} [params] - The high-level/mongo query parameters.
   * @returns {Promise<T[]>} - A promise that resolves to an array of found documents.
   */
  public async find(
    params?: FindParams | MongoFindQueryParams<T>
  ): Promise<T[]> {
    try {
      const query = FindParams.isFindParams(params)
        ? this.queries.createFindQuery(params)
        : params;
      const filter = query?.filter || {};
      const options = query?.options || {};

      const cursor = this.collection.find<T>(filter, options);
      const list = await cursor.toArray();
      return list;
    } catch (error) {
      this.throwCollectionError(error);
    }
  }

  /**
   * Counts documents in the collection based on the provided query parameters.
   * @param {CountParams | MongoCountQueryParams<T>} [params] - The high-level/mongo query parameters.
   * @returns {Promise<number>} - A promise that resolves to the count of documents.
   */
  public async count(
    params?: CountParams | MongoCountQueryParams<T>
  ): Promise<number> {
    try {
      const query = CountParams.isCountParams(params)
        ? this.queries.createCountQuery(params)
        : params;
      const filter = query?.filter || {};
      const options = query?.options || {};
      const count = await this.collection.countDocuments(filter, options);
      return count;
    } catch (error) {
      this.throwCollectionError(error);
    }
  }

  /**
   * Executes an aggregation pipeline on the collection.
   * @param {AggregationParams | MongoAggregateParams} params - The aggregation query parameters.
   * @returns {Promise<AggregationType[]>} - A promise that resolves to the result of the aggregation.
   */
  public async aggregate<AggregationType = T>(
    params: AggregationParams | MongoAggregateParams
  ): Promise<AggregationType[]> {
    try {
      const query = AggregationParams.isAggregationParams(params)
        ? this.queries.createAggregationQuery(params)
        : params;

      const { pipeline, options } = query;
      if (options) {
        options.allowDiskUse = true;
      }
      const cursor = this.collection.aggregate<AggregationType>(
        pipeline,
        options
      );
      const list = await cursor.toArray();
      return list;
    } catch (error) {
      this.throwCollectionError(error);
    }
  }

  /**
   * Updates documents in the collection based on the provided update parameters.
   * @param {UpdateParams | MongoUpdateQueryParams<T> | AnyBulkWriteOperation<T>[]} params - The high-level/mongo update parameters.
   * @returns {Promise<UpdateStats>} - A promise that resolves to the update statistics.
   */
  public async update(
    params:
      | UpdateParams
      | MongoUpdateQueryParams<T>
      | mongoDb.AnyBulkWriteOperation<T>[]
  ): Promise<UpdateStats> {
    try {
      let query;

      if (UpdateParams.isUpdateParams(params)) {
        const { updates, where, methods } = params;
        query = this.queries.createUpdateQuery(updates, where, methods);
      } else {
        query = params;
      }

      if (Array.isArray(query)) {
        if (MongoUtils.isBulkUpdate<T>(query)) {
          const updateResult = await this.collection.bulkWrite(query);
          const { matchedCount, modifiedCount, upsertedCount, upsertedIds } =
            updateResult;
          return {
            status:
              matchedCount > 0
                ? OperationStatus.Success
                : OperationStatus.Failure,
            modifiedCount: modifiedCount,
            upsertedCount: upsertedCount,
            upsertedIds: upsertedIds ? Object.values(upsertedIds) : [],
          };
        }

        throw new BulkUpdateOperationsError();
      }

      const { filter, update, options, method } = query;
      let updateResult: mongoDb.UpdateResult;

      if (method === UpdateMethod.UpdateOne) {
        updateResult = await this.collection.updateOne(filter, update, options);
      } else {
        const updateManyResult = await this.collection.updateMany(
          filter,
          update,
          options
        );

        updateResult = updateManyResult as mongoDb.UpdateResult;
      }

      const { matchedCount, modifiedCount, upsertedCount, upsertedId } =
        updateResult;

      return {
        status:
          matchedCount > 0 ? OperationStatus.Success : OperationStatus.Failure,
        modifiedCount: modifiedCount,
        upsertedCount: upsertedCount,
        upsertedIds: upsertedId ? [upsertedId] : [],
      };
    } catch (error) {
      this.throwCollectionError(error);
    }
  }

  /**
   * Inserts documents into the collection.
   * @param {OptionalUnlessRequiredId<T>[] | MongoInsertQueryParams<T>} query - The documents to insert.
   * @returns {Promise<T[]>} - A promise that resolves to the inserted documents.
   */
  public async insert(
    query: mongoDb.OptionalUnlessRequiredId<T>[] | MongoInsertQueryParams<T>
  ): Promise<T[]> {
    const options: mongoDb.BulkWriteOptions = { ordered: true };
    const documents = [];
    try {
      if (Array.isArray(query)) {
        documents.push(...query);
      } else {
        documents.push(...query.documents);
        if (query.options) {
          Object.assign(options, query.options);
        }
      }

      const insertResult = await this.collection.insertMany(documents, options);
      const insertedDocuments = documents.map((document, index) => ({
        _id: insertResult.insertedIds[index],
        ...document,
      }));

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
          const failedIndices = new Set();
          for (const writeError of error.writeErrors) {
            const failedIndex = writeError.index;
            failedDocuments.push(documents[failedIndex]);
            failedIndices.add(failedIndex);
          }

          for (let i = 0; i < documents.length; i++) {
            if (!failedIndices.has(i)) {
              insertedDocuments.push(documents[i]);
            }
          }
        }
      }

      this.throwCollectionError(error, {
        duplicatedIds,
        insertedDocuments,
        failedDocuments,
      });
    }
  }

  /**
   * Removes documents from the collection based on the provided query parameters.
   * @param {RemoveParams | MongoDeleteQueryParams} params - The high-level/mongo query parameters.
   * @returns {Promise<RemoveStats>} - A promise that resolves to the remove statistics.
   */
  public async remove(
    params: RemoveParams | MongoDeleteQueryParams<T>
  ): Promise<RemoveStats> {
    try {
      const query = RemoveParams.isRemoveParams(params)
        ? this.queries.createRemoveQuery(params)
        : params;
      const { acknowledged, deletedCount } = await this.collection.deleteMany(
        query.filter
      );
      const status =
        acknowledged && deletedCount > 0
          ? OperationStatus.Success
          : acknowledged && deletedCount === 0
          ? OperationStatus.Failure
          : OperationStatus.Pending;

      return {
        status,
        deletedCount,
      };
    } catch (error) {
      this.throwCollectionError(error);
    }
  }

  /**
   * Starts a transaction on the current session.
   * @param {TransactionOptions} [options] - The transaction options.
   * @returns {Promise<void>} - A promise that resolves when the transaction starts.
   */
  public async startTransaction(
    options?: mongoDb.TransactionOptions
  ): Promise<void> {
    if (this.currentSession) {
      throw CollectionError.createError(new PendingSessionError());
    }
    try {
      this.currentSession = this.client.client.startSession();
      this.currentSession.startTransaction(options);
    } catch (error) {
      throw CollectionError.createError(new SessionError(error));
    }
  }

  /**
   * Commits the current transaction.
   * @returns {Promise<void>} - A promise that resolves when the transaction is committed.
   */
  public async commitTransaction(): Promise<void> {
    if (this.currentSession) {
      try {
        await this.currentSession.commitTransaction();
        await this.currentSession.endSession();
        this.currentSession = null;
      } catch (error) {
        throw CollectionError.createError(new SessionError(error));
      }
    }
  }

  /**
   * Rolls back the current transaction.
   * @returns {Promise<void>} - A promise that resolves when the transaction is rolled back.
   */
  public async rollbackTransaction(): Promise<void> {
    if (this.currentSession) {
      try {
        await this.currentSession.abortTransaction();
        await this.currentSession.endSession();
        this.currentSession = null;
      } catch (error) {
        throw CollectionError.createError(new SessionError(error));
      }
    }
  }
}
