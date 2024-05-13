/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Condition,
  NestedCondition,
  Where,
  VariedCondition,
} from "@soapjs/soap";

export class MongoWhereParser {
  static parse(data: Where | Condition | VariedCondition | null): any {
    if (!data) {
      return {};
    }

    if (data instanceof Where) {
      return MongoWhereParser.parse(data.build());
    }

    if (data instanceof Condition) {
      // It's a simple condition
      return MongoWhereParser.parseSimpleCondition(data);
    }

    if (data instanceof VariedCondition) {
      // It's a varied condition
      return MongoWhereParser.parseVariedCondition(data);
    }

    throw new Error("Invalid condition format");
  }

  private static parseSimpleCondition(condition: Condition): any {
    const { left, operator, right } = condition;
    switch (operator) {
      case "eq":
        return { [left]: { $eq: right } };
      case "ne":
        return { [left]: { $ne: right } };
      case "gt":
        return { [left]: { $gt: right } };
      case "lt":
        return { [left]: { $lt: right } };
      case "gte":
        return { [left]: { $gte: right } };
      case "lte":
        return { [left]: { $lte: right } };
      case "in":
        return { [left]: { $in: right } };
      case "nin":
        return { [left]: { $nin: right } };
      case "like":
        return { [left]: { $regex: right, $options: "i" } }; // Assuming 'like' translates to a regex match
      default:
        throw new Error(`Unsupported operator ${operator}`);
    }
  }

  private static parseVariedCondition(data: VariedCondition): any {
    const { conditions, operator } = data;
    const parsedConditions = conditions.map((cond) =>
      MongoWhereParser.parse(cond)
    );

    if (operator === "and") {
      return { $and: parsedConditions };
    } else if (operator === "or") {
      return { $or: parsedConditions };
    }

    throw new Error(`Unsupported logical operator ${operator}`);
  }
}
