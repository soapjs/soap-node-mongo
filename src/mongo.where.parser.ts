/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Mapper,
  UnsupportedOperatorError,
  Where,
  WhereClause,
  WhereOperator,
} from '@soapjs/soap';
import * as mongoDb from 'mongodb';

/**
 * Class for parsing Where clauses and converting them into MongoDB filter objects.
 */
export class MongoWhereParser {
  /**
   * Map of Where operators to their corresponding MongoDB operators.
   * @type {Object.<WhereOperator, string | Object>}
   * @private
   */
  private static operatorMap = {
    [WhereOperator.isEq]: '$eq',
    [WhereOperator.isNotEq]: '$ne',
    [WhereOperator.isLt]: '$lt',
    [WhereOperator.isLte]: '$lte',
    [WhereOperator.isGt]: '$gt',
    [WhereOperator.isGte]: '$gte',
    [WhereOperator.isInRange]: '$in',
    [WhereOperator.isNotInRange]: '$nin',
    [WhereOperator.isBetween]: { $gte: NaN, $lte: NaN },
    [WhereOperator.isIn]: '$in',
    [WhereOperator.isNotIn]: '$nin',
    [WhereOperator.isTrue]: '$eq',
    [WhereOperator.isFalse]: '$eq',
    [WhereOperator.is0]: '$eq',
    [WhereOperator.is1]: '$eq',
    [WhereOperator.isNull]: '$eq',
    [WhereOperator.isNotNull]: '$ne',
    [WhereOperator.isEmpty]: { $or: [{ $eq: '' }, { $eq: [] }, { $eq: {} }] },
    [WhereOperator.isNotEmpty]: {
      $and: [{ $ne: '' }, { $ne: [] }, { $ne: {} }],
    },
  };

  /**
   * Parses a Where clause or an object and converts it into a MongoDB filter object.
   *
   * @template T - The type of the resulting MongoDB filter object.
   * @param {Where | unknown} where - The Where clause or object to parse.
   * @returns {T} The parsed MongoDB filter object.
   * @throws {Error} If the Where clause contains an unsupported operator.
   */
  public static parse<T = mongoDb.Filter<unknown>>(where: Where | unknown, mapper?: Mapper): T {
    const query = {} as T;
    if (where instanceof Where && where.isRaw) {
      return where.result as T;
    } else if (where instanceof Where && where.isRaw === false) {
      const {
        result: { groups, ...chain },
      } = where;
      for (const key in chain) {
        const whereClauses = chain[key] as WhereClause[];

        for (const whereClause of whereClauses) {
          const queryPart = MongoWhereParser.parseClause(whereClause);
          const keyQyery = query[key] ? query[key] : {};
          query[key] = { ...keyQyery, ...queryPart };
        }
      }
    } else {
      const operator = Object.keys(where)[0];
      const wheres = where[operator];

      if (operator !== 'and' && operator !== 'or') {
        throw new UnsupportedOperatorError(operator);
      }

      query['$' + operator] = wheres.map(where => this.parse(where, mapper));
    }

    return query;
  }

  private static parseClause(
    whereClause: WhereClause,
  ) {
    const { operator, value } = whereClause;
    const mongoOperator = MongoWhereParser.operatorMap[operator];
    if (!mongoOperator) {
      throw new UnsupportedOperatorError(WhereOperator[operator]);
    }
    if (operator === WhereOperator.isEmpty || operator === WhereOperator.isNotEmpty) {
      return mongoOperator;
    } else if (operator === WhereOperator.isBetween) {
      return { $gte: value[0], $lte: value[1] };
    } else if (operator === WhereOperator.isNull) {
      return { [mongoOperator]: null };
    } else {
      return { [mongoOperator]: value };
    }
  }
}
