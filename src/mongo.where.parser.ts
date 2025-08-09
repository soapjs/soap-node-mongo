/* eslint-disable @typescript-eslint/no-unused-vars */
import { Where, Condition, VariedCondition, NestedCondition, ConditionWithManyKeys } from "@soapjs/soap";
import * as mongoDb from "mongodb";

/**
 * MongoDB where parser for converting Where conditions to MongoDB filters.
 */
export class MongoWhereParser {
  /**
   * Parses a Where condition into a MongoDB filter.
   * @param {Where} where - The where condition to parse.
   * @returns {mongoDb.Filter<mongoDb.Document>} The MongoDB filter.
   */
  parse(where: Where): mongoDb.Filter<mongoDb.Document> {
    if (!where) {
      return {};
    }

    const condition = where.build();
    if (!condition) {
      return {};
    }

    return this.parseCondition(condition);
  }

  /**
   * Parses a single condition into a MongoDB filter.
   * @param {Condition | VariedCondition | NestedCondition | ConditionWithManyKeys} condition - The condition to parse.
   * @returns {mongoDb.Filter<mongoDb.Document>} The MongoDB filter.
   */
  private parseCondition(condition: Condition | VariedCondition | NestedCondition | ConditionWithManyKeys): mongoDb.Filter<mongoDb.Document> {
    if (!condition) {
      return {};
    }

    // Handle VariedCondition (AND/OR)
    if (this.isVariedCondition(condition)) {
      const parsedConditions = condition.conditions.map((cond: any) => this.parseCondition(cond));
      
      if (condition.operator === "and") {
        return { $and: parsedConditions };
      } else if (condition.operator === "or") {
        return { $or: parsedConditions };
      }
    }

    // Handle NestedCondition
    if (this.isNestedCondition(condition)) {
      return this.parseCondition(condition.result);
    }

    // Handle ConditionWithManyKeys
    if (this.isConditionWithManyKeys(condition)) {
      const { left, operator, right } = condition;
      const conditions = left.map(key => this.createCondition(key, operator, right));
      return { $or: conditions };
    }

    // Handle simple Condition
    if (this.isCondition(condition)) {
      const { left, operator, right } = condition;
      return this.createCondition(left, operator, right);
    }

    return {};
  }

  /**
   * Creates a MongoDB condition from a field, operator, and value.
   * @param {string} field - The field name.
   * @param {string} operator - The operator.
   * @param {any} value - The value.
   * @returns {mongoDb.Filter<mongoDb.Document>} The MongoDB condition.
   */
  private createCondition(field: string, operator: string, value: any): mongoDb.Filter<mongoDb.Document> {
    switch (operator) {
      case "eq":
        return { [field]: value };
      case "ne":
        return { [field]: { $ne: value } };
      case "gt":
        return { [field]: { $gt: value } };
      case "gte":
        return { [field]: { $gte: value } };
      case "lt":
        return { [field]: { $lt: value } };
      case "lte":
        return { [field]: { $lte: value } };
      case "in":
        return { [field]: { $in: Array.isArray(value) ? value : [value] } };
      case "nin":
        return { [field]: { $nin: Array.isArray(value) ? value : [value] } };
      case "like":
        // Handle regex patterns
        let pattern = value;
        if (typeof value === 'string') {
          // Convert SQL-like patterns to regex
          pattern = value.replace(/%/g, '.*').replace(/_/g, '.');
          if (!pattern.startsWith('.*')) {
            pattern = '^' + pattern;
          }
          if (!pattern.endsWith('.*')) {
            pattern = pattern + '$';
          }
        }
        return { [field]: { $regex: pattern, $options: "i" } };
      default:
        return { [field]: value };
    }
  }

  /**
   * Checks if a condition is a VariedCondition.
   * @param {any} condition - The condition to check.
   * @returns {boolean} True if it's a VariedCondition.
   */
  private isVariedCondition(condition: any): condition is VariedCondition {
    return condition && condition.conditions && Array.isArray(condition.conditions) && condition.operator;
  }

  /**
   * Checks if a condition is a NestedCondition.
   * @param {any} condition - The condition to check.
   * @returns {boolean} True if it's a NestedCondition.
   */
  private isNestedCondition(condition: any): condition is NestedCondition {
    return condition && condition.result;
  }

  /**
   * Checks if a condition is a ConditionWithManyKeys.
   * @param {any} condition - The condition to check.
   * @returns {boolean} True if it's a ConditionWithManyKeys.
   */
  private isConditionWithManyKeys(condition: any): condition is ConditionWithManyKeys {
    return condition && condition.left && Array.isArray(condition.left) && condition.operator;
  }

  /**
   * Checks if a condition is a Condition.
   * @param {any} condition - The condition to check.
   * @returns {boolean} True if it's a Condition.
   */
  private isCondition(condition: any): condition is Condition {
    return condition && condition.left && typeof condition.left === 'string' && condition.operator;
  }

  /**
   * Static method for backward compatibility.
   * @param {any} where - The where condition to parse.
   * @returns {mongoDb.Filter<mongoDb.Document>} The MongoDB filter.
   */
  static parse(where: any): mongoDb.Filter<mongoDb.Document> {
    const parser = new MongoWhereParser();
    return parser.parse(where);
  }
}
