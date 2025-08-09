/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  DbQueryFactory,
  FindParams,
  CountParams,
  AggregationParams,
  UpdateParams,
  RemoveParams,
  UpdateMethod,
  Where,
  DbQuery
} from "@soapjs/soap";
import * as mongoDb from "mongodb";
import { MongoWhereParser } from "./mongo.where.parser";
import { CollectionOptions } from "./mongo.types";

/**
 * MongoDB implementation of DbQueryFactory.
 * @template T - The type of the document.
 */
export class MongoQueryFactory<T> implements DbQueryFactory {
  private whereParser: MongoWhereParser;

  constructor(options?: CollectionOptions<T>) {
    this.whereParser = new MongoWhereParser();
  }

  /**
   * Creates a find query for MongoDB.
   * @param {FindParams} params - The find parameters.
   * @returns {DbQuery} The MongoDB find query.
   */
  createFindQuery(params: FindParams, ...args: unknown[]): DbQuery {
    const filter: mongoDb.Filter<mongoDb.Document> = {};
    const options: mongoDb.FindOptions = {};

    if (params.where) {
      Object.assign(filter, this.whereParser.parse(params.where));
    }

    if (params.limit) {
      options.limit = params.limit;
    }

    if (params.offset !== undefined) {
      options.skip = params.offset;
    }

    if (params.sort) {
      options.sort = params.sort as any;
    }

    if (params.projection) {
      options.projection = params.projection as any;
    }

    return {
      filter,
      options,
    } as DbQuery;
  }

  /**
   * Creates a count query for MongoDB.
   * @param {CountParams} params - The count parameters.
   * @returns {DbQuery} The MongoDB count query.
   */
  createCountQuery(params: CountParams, ...args: unknown[]): DbQuery {
    const filter: mongoDb.Filter<mongoDb.Document> = {};
    const options: mongoDb.CountDocumentsOptions = {};

    if (params.where) {
      Object.assign(filter, this.whereParser.parse(params.where));
    }

    return {
      filter,
      options,
    } as DbQuery;
  }

  /**
   * Creates an update query for MongoDB.
   * @param {UpdateType[]} updates - The updates to apply.
   * @param {Where[]} where - The where conditions.
   * @param {UpdateMethod[]} methods - The update methods.
   * @returns {DbQuery} The MongoDB update query.
   */
  createUpdateQuery<UpdateType = unknown>(
    updates: UpdateType[],
    where: Where[],
    methods: UpdateMethod[],
    ...args: unknown[]
  ): DbQuery {
    if (updates.length !== where.length || updates.length !== methods.length) {
      throw new Error("Updates, where conditions, and methods arrays must have the same length");
    }

    const filter: mongoDb.Filter<mongoDb.Document> = {};
    const update: mongoDb.UpdateFilter<mongoDb.Document> = {};
    const options: mongoDb.UpdateOptions = {};

    // Combine all where conditions with AND
    const combinedWhere = where.reduce((acc, curr) => {
      return { ...acc, ...this.whereParser.parse(curr) };
    }, {});

    Object.assign(filter, combinedWhere);

    // Combine all updates
    const combinedUpdate = updates.reduce((acc, curr) => {
      return { ...acc, ...curr };
    }, {});

    Object.assign(update, { $set: combinedUpdate });

    // Set options based on methods
    if (methods.includes(UpdateMethod.UpdateMany)) {
      // In newer MongoDB versions, multi is deprecated, use updateMany instead
      // options.multi = true; // This is deprecated
    }

    if (methods.includes(UpdateMethod.UpdateOne)) {
      // For UpdateOne, we don't need to set any special options
    }

    return {
      filter,
      update,
      options,
    } as DbQuery;
  }

  /**
   * Creates a remove query for MongoDB.
   * @param {RemoveParams} params - The remove parameters.
   * @returns {DbQuery} The MongoDB remove query.
   */
  createRemoveQuery(params: RemoveParams, ...args: unknown[]): DbQuery {
    const filter: mongoDb.Filter<mongoDb.Document> = {};
    const options: mongoDb.DeleteOptions = {};

    if (params.where) {
      Object.assign(filter, this.whereParser.parse(params.where));
    }

    return {
      filter,
      options,
    } as DbQuery;
  }

  /**
   * Creates an aggregation query for MongoDB.
   * @param {AggregationParams} params - The aggregation parameters.
   * @returns {DbQuery} The MongoDB aggregation query.
   */
  createAggregationQuery(params: AggregationParams, ...args: unknown[]): DbQuery {
    const pipeline: mongoDb.Document[] = [];
    const options: mongoDb.AggregateOptions = {};

    if (params.where) {
      const filter = this.whereParser.parse(params.where);
      pipeline.push({ $match: filter });
    }

    if (params.groupBy) {
      const groupStage: any = { $group: { _id: {} } };
      
      if (Array.isArray(params.groupBy)) {
        params.groupBy.forEach(field => {
          groupStage.$group._id[field] = `$${field}`;
        });
      } else {
        groupStage.$group._id = `$${params.groupBy}`;
      }

      // Add aggregation functions
      if (params.sum) {
        const sumFields = Array.isArray(params.sum) ? params.sum : [params.sum];
        sumFields.forEach(field => {
          groupStage.$group[`sum_${field}`] = { $sum: `$${field}` };
        });
      }
      if (params.average) {
        const averageFields = Array.isArray(params.average) ? params.average : [params.average];
        averageFields.forEach(field => {
          groupStage.$group[`average_${field}`] = { $avg: `$${field}` };
        });
      }
      if (params.min) {
        const minFields = Array.isArray(params.min) ? params.min : [params.min];
        minFields.forEach(field => {
          groupStage.$group[`min_${field}`] = { $min: `$${field}` };
        });
      }
      if (params.max) {
        const maxFields = Array.isArray(params.max) ? params.max : [params.max];
        maxFields.forEach(field => {
          groupStage.$group[`max_${field}`] = { $max: `$${field}` };
        });
      }
      if (params.count) {
        const countFields = Array.isArray(params.count) ? params.count : [params.count];
        countFields.forEach(field => {
          groupStage.$group[`count_${field}`] = { $sum: 1 };
        });
      }

      pipeline.push(groupStage);
    }

    if (params.having) {
      pipeline.push({ $match: params.having });
    }

    if (params.sort) {
      pipeline.push({ $sort: params.sort });
    }

    if (params.limit) {
      pipeline.push({ $limit: params.limit });
    }

    if (params.offset) {
      pipeline.push({ $skip: params.offset });
    }

    return {
      pipeline,
      options,
    } as DbQuery;
  }
}
