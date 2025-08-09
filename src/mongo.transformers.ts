import { ObjectId } from "mongodb";
import { PropertyTransformer } from "@soapjs/soap";

/**
 * Common MongoDB transformers for field mapping.
 */
export class MongoTransformers {
  /**
   * Transforms string ID to ObjectId and vice versa.
   */
  static objectId: PropertyTransformer = {
    to: (value: string) => {
      if (!value) return value;
      return new ObjectId(value);
    },
    from: (value: ObjectId | string) => {
      if (!value) return value;
      return value instanceof ObjectId ? value.toString() : value;
    }
  };

  /**
   * Transforms Date to ISO string and vice versa.
   */
  static date: PropertyTransformer = {
    to: (value: Date) => {
      if (!value) return value;
      return value instanceof Date ? value.toISOString() : value;
    },
    from: (value: string | Date) => {
      if (!value) return value;
      return typeof value === 'string' ? new Date(value) : value;
    }
  };

  /**
   * Transforms array to comma-separated string and vice versa.
   */
  static arrayToString: PropertyTransformer = {
    to: (value: any[]) => {
      if (!Array.isArray(value)) return value;
      return value.join(',');
    },
    from: (value: string) => {
      if (!value || typeof value !== 'string') return value;
      return value.split(',').filter(item => item.trim() !== '');
    }
  };

  /**
   * Transforms object to JSON string and vice versa.
   */
  static objectToJson: PropertyTransformer = {
    to: (value: object) => {
      if (!value || typeof value !== 'object') return value;
      return JSON.stringify(value);
    },
    from: (value: string) => {
      if (!value || typeof value !== 'string') return value;
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
  };

  /**
   * Transforms boolean to number (0/1) and vice versa.
   */
  static booleanToNumber: PropertyTransformer = {
    to: (value: boolean) => {
      if (typeof value !== 'boolean') return value;
      return value ? 1 : 0;
    },
    from: (value: number | boolean) => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value === 1;
      return value;
    }
  };

  /**
   * Transforms string to lowercase and vice versa.
   */
  static lowercase: PropertyTransformer = {
    to: (value: string) => {
      if (typeof value !== 'string') return value;
      return value.toLowerCase();
    },
    from: (value: string) => {
      if (typeof value !== 'string') return value;
      return value;
    }
  };

  /**
   * Transforms string to uppercase and vice versa.
   */
  static uppercase: PropertyTransformer = {
    to: (value: string) => {
      if (typeof value !== 'string') return value;
      return value.toUpperCase();
    },
    from: (value: string) => {
      if (typeof value !== 'string') return value;
      return value;
    }
  };

  /**
   * Transforms number to cents (multiplies by 100) and vice versa.
   */
  static cents: PropertyTransformer = {
    to: (value: number) => {
      if (typeof value !== 'number') return value;
      return Math.round(value * 100);
    },
    from: (value: number) => {
      if (typeof value !== 'number') return value;
      return value / 100;
    }
  };

  /**
   * Transforms array of ObjectIds to array of strings and vice versa.
   */
  static objectIdArray: PropertyTransformer = {
    to: (value: string[]) => {
      if (!Array.isArray(value)) return value;
      return value.map(id => new ObjectId(id));
    },
    from: (value: ObjectId[] | string[]) => {
      if (!Array.isArray(value)) return value;
      return value.map(id => id instanceof ObjectId ? id.toString() : id);
    }
  };

  /**
   * Transforms Date to timestamp (number) and vice versa.
   */
  static timestamp: PropertyTransformer = {
    to: (value: Date) => {
      if (!(value instanceof Date)) return value;
      return value.getTime();
    },
    from: (value: number | Date) => {
      if (typeof value === 'number') return new Date(value);
      if (value instanceof Date) return value;
      return value;
    }
  };

  /**
   * Transforms string to trimmed string.
   */
  static trim: PropertyTransformer = {
    to: (value: string) => {
      if (typeof value !== 'string') return value;
      return value.trim();
    },
    from: (value: string) => {
      if (typeof value !== 'string') return value;
      return value;
    }
  };
}
