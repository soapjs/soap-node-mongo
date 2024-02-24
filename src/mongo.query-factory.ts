/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  AggregationParams,
  CountParams,
  FindParams,
  Mapper,
  QueryFactory,
  RemoveParams,
  UpdateMethod,
  Where,
} from "@soapjs/soap";
import {
  MongoAggregateParams,
  MongoCountQueryParams,
  MongoDeleteQueryParams,
  MongoFindQueryParams,
  MongoUpdateQueryParams,
} from "./mongo.types";
import * as MongoDB from "mongodb";
import { MongoWhereParser } from "./mongo.where.parser";
import {
  InconsistentUpdateParamsError,
  UnknownUpdateMethodError,
} from "./mongo.errors";

/**
 * Represents a MongoDB query factory for constructing various types of queries.
 */
export class MongoQueryFactory implements QueryFactory {
  /**
   * Constructs a new instance of the MongoQueryBuilders class.
   *
   * If a Mapper instance is provided, it can be used to convert entity keys
   * and values into a format suitable for MongoDB. This can be especially useful
   * in situations where the case of keys or format of values in the original entity
   * doesn't match MongoDB's requirements.
   *
   * @param {Mapper} [mapper] - An optional Mapper instance for entity key and value conversion.
   */
  constructor(private mapper?: Mapper) {}

  /**
   * Builds a find query for MongoDB.
   * @param {FindParams} params - The parameters for the find query.
   * @returns {MongoFindQueryParams} The find query parameters.
   */
  public createFindQuery(params: FindParams): MongoFindQueryParams {
    const { limit, offset, sort, where } = params;
    const filter = where ? MongoWhereParser.parse(where, this.mapper) : {};
    const options: MongoDB.FindOptions = {};

    if (limit) {
      options.limit = limit;
    }

    if (sort) {
      options.sort = sort as MongoDB.Sort;
    }

    if (Number.isFinite(offset)) {
      options.skip = offset;
    }

    return { filter, options };
  }

  /**
   * Builds a count query for MongoDB.
   * @param {CountParams} params - The parameters for the count query.
   * @returns {MongoCountQueryParams} The count query parameters.
   */
  public createCountQuery(params: CountParams): MongoCountQueryParams {
    const { sort, where } = params;
    const filter = where ? MongoWhereParser.parse(where, this.mapper) : {};
    const options: MongoDB.FindOptions = {};

    if (sort) {
      options.sort = sort as MongoDB.Sort;
    }

    return { filter, options };
  }

  /**
   * Builds an update query for MongoDB.
   * @template UpdateType - The type of the update operation.
   * @param {UpdateType[]} updates - The updates to be performed.
   * @param {Where[]} where - The conditions for updating documents.
   * @param {UpdateMethod[]} methods - The update methods for each update operation.
   * @returns {MongoUpdateQueryParams | MongoDB.AnyBulkWriteOperation<UpdateType>[]} The update query parameters or bulk write operations.
   * @throws {InconsistentUpdateParamsError} If the number of updates, where clauses, and methods don't match.
   * @throws {UnknownUpdateMethodError} If an unknown update method is provided.
   */
  public createUpdateQuery<UpdateType = unknown>(
    updates: UpdateType[],
    where: Where[],
    methods: UpdateMethod[]
  ): MongoUpdateQueryParams | MongoDB.AnyBulkWriteOperation<UpdateType>[] {
    //
    const updatesSize = updates.length;
    const whereSize = where.length;
    const methodsSize = methods.length;

    if (methodsSize > 1) {
      if ((methodsSize + updatesSize + whereSize) / 3 !== methodsSize) {
        throw new InconsistentUpdateParamsError(
          updatesSize,
          whereSize,
          methodsSize
        );
      }

      return methods.map((method, i) => {
        const isUpdateOne = method === UpdateMethod.UpdateOne;

        const operationParams: {
          upsert?: boolean;
          filter: MongoDB.Filter<UpdateType>;
          update: MongoDB.UpdateFilter<UpdateType>;
        } = {
          filter: MongoWhereParser.parse(where[i]),
          update: { $set: updates[i] } as MongoDB.UpdateFilter<UpdateType>,
        };

        if (isUpdateOne) {
          operationParams.upsert = true;
          return {
            updateOne: operationParams,
          } as MongoDB.AnyBulkWriteOperation<UpdateType>;
        }

        return {
          updateMany: operationParams,
        } as MongoDB.AnyBulkWriteOperation<UpdateType>;
      });
    } else {
      const method = methods[0];

      if (method === UpdateMethod.UpdateOne) {
        return {
          filter: MongoWhereParser.parse(where[0]),
          update: { $set: updates[0] },
          options: {
            upsert: true,
          },
          method,
        };
      } else if (method === UpdateMethod.UpdateMany) {
        return {
          filter: MongoWhereParser.parse(where[0]),
          update: { $set: updates[0] },
          method,
        };
      } else {
        throw new UnknownUpdateMethodError(method);
      }
    }
  }

  /**
   * Builds a remove query for MongoDB.
   * @param {RemoveParams} params - The parameters for the remove query.
   * @returns {MongoDeleteQueryParams} The remove query parameters.
   */
  public createRemoveQuery(params: RemoveParams): MongoDeleteQueryParams {
    const { where } = params;
    const filter = where ? MongoWhereParser.parse(where, this.mapper) : {};
    const options: MongoDB.DeleteOptions = {};

    return { filter, options };
  }

  /**
   * Builds an aggregation query for MongoDB.
   * @param {AggregationParams} params - The parameters for the aggregation query.
   * @returns {MongoAggregateParams} The aggregation query parameters.
   */
  public createAggregationQuery(
    params: AggregationParams
  ): MongoAggregateParams {
    const { filterBy, sort, sum, average, min, max, count, where } = params;
    const pipeline = [];
    const groupBy = params.groupBy || [];

    const groupByFields = groupBy.reduce((acc, field) => {
      acc[field] = `$${field}`;
      return acc;
    }, {});

    if (where) {
      pipeline.push({
        $match: MongoWhereParser.parse(where, this.mapper),
      });
    }

    if (groupBy.length > 0) {
      const group = {
        _id: groupByFields,
        ...(sum && { totalSum: { $sum: `$${sum}` } }),
        ...(average && { average: { $avg: `$${average}` } }),
        ...(min && { min: { $min: `$${min}` } }),
        ...(max && { max: { $max: `$${max}` } }),
        ...(count && { count: { $sum: 1 } }),
      };

      pipeline.push({
        $group: group,
      });
    }

    if (sort) {
      pipeline.push({
        $sort: sort as MongoDB.Sort,
      });
    }

    if (filterBy) {
      pipeline.push({
        $match: MongoWhereParser.parse(filterBy),
      });
    }

    const options: MongoDB.AggregateOptions = {};
    return { pipeline, options };
  }
}
