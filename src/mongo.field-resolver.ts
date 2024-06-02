import {
  Condition,
  FieldInfo,
  FieldResolver,
  ModelConstructor,
  VariedCondition,
} from "@soapjs/soap";

/**
 * A class to resolve fields from domain-specific field names to database-specific field names.
 * This resolver supports both dynamic resolution via a model class and static resolution via provided field mappings.
 * @template T - The type of the model the resolver handles.
 */
export class MongoFieldResolver<T> {
  private resolver: FieldResolver<T> | any;

  /**
   * Constructs a MongoFieldResolver instance.
   * @param {object} options - Configuration options for the resolver which can include either a model class or field mappings.
   * @param {ModelConstructor<T>?} options.modelClass - A class that can be instantiated to access field mapping metadata.
   * @param {Object<string, FieldInfo>?} options.modelFieldMappings - A dictionary mapping domain field names to their database counterparts.
   */
  constructor(
    private options: {
      modelClass?: ModelConstructor<T>;
      modelFieldMappings?: {
        [key: string]: FieldInfo;
      };
    }
  ) {
    if (this.options.modelClass) {
      this.resolver = new FieldResolver<T>(options.modelClass);
    } else if (this.options.modelFieldMappings) {
      this.resolver = {
        resolveDatabaseField: (domainField: string) =>
          this.options.modelFieldMappings[domainField],
      };
    }
  }

  /**
   * Resolves a domain-specific field name to a database-specific field name.
   * @param {string} domainField - The domain-specific field name to resolve.
   * @returns {FieldInfo | undefined} - The database-specific field information or undefined if not found.
   */
  resolveDatabaseField(domainField: string): FieldInfo | undefined {
    return this.resolver.resolveDatabaseField(domainField);
  }

  /**
   * Resolves an object's properties from domain-specific field names to database-specific field names.
   * This method handles `Condition`, `VariedCondition`, and plain objects.
   * @param {object} obj - The object to resolve.
   * @returns {object} - The resolved object with database-specific field names.
   */
  resolve(obj: any) {
    if (!obj) return obj;

    let _obj = Array.isArray(obj) ? [] : {};

    if (obj instanceof Condition) {
      const leftResolved = this.resolveDatabaseField(obj.left);
      const rightResolved =
        typeof obj.right === "object" ? this.resolve(obj.right) : obj.right;
      _obj = new Condition(
        leftResolved ? leftResolved.name : obj.left,
        obj.operator,
        rightResolved
      );
    } else if (obj instanceof VariedCondition) {
      _obj = new VariedCondition(
        obj.conditions.map((condition) => this.resolve(condition)),
        obj.operator
      );
    } else {
      Object.keys(obj).forEach((key) => {
        const field = this.resolveDatabaseField(key);
        _obj[field ? field.name : key] = obj[key];
      });
    }

    return _obj;
  }
}
