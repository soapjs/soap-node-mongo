import * as mongoDb from "mongodb";

/**
 * Performance metrics for MongoDB operations.
 */
export interface MongoPerformanceMetrics {
  /** Operation type (find, insert, update, delete, aggregate) */
  operation: string;
  /** Collection name */
  collection: string;
  /** Operation duration in milliseconds */
  duration: number;
  /** Number of documents affected */
  documentCount?: number;
  /** Query complexity (estimated) */
  queryComplexity?: 'simple' | 'complex' | 'aggregation';
  /** Whether operation was successful */
  success: boolean;
  /** Error message if operation failed */
  error?: string;
  /** Timestamp when operation started */
  timestamp: Date;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Performance monitoring configuration.
 */
export interface MongoPerformanceConfig {
  /** Enable performance monitoring */
  enabled: boolean;
  /** Collect detailed metrics */
  detailed: boolean;
  /** Slow query threshold in milliseconds */
  slowQueryThreshold: number;
  /** Maximum number of metrics to keep in memory */
  maxMetrics: number;
  /** Custom metrics collector */
  metricsCollector?: (metrics: MongoPerformanceMetrics) => void;
}

/**
 * Performance monitoring interface.
 */
export interface MongoPerformanceMonitor {
  /** Start timing an operation */
  startOperation(operation: string, collection: string, metadata?: Record<string, any>): string;
  /** End timing an operation */
  endOperation(operationId: string, documentCount?: number, error?: Error): void;
  /** Get performance metrics */
  getMetrics(): MongoPerformanceMetrics[];
  /** Get slow queries */
  getSlowQueries(): MongoPerformanceMetrics[];
  /** Clear metrics */
  clearMetrics(): void;
  /** Get performance summary */
  getSummary(): MongoPerformanceSummary;
}

/**
 * Performance summary statistics.
 */
export interface MongoPerformanceSummary {
  /** Total operations */
  totalOperations: number;
  /** Average operation duration */
  averageDuration: number;
  /** Slow operations count */
  slowOperations: number;
  /** Error rate */
  errorRate: number;
  /** Operations by type */
  operationsByType: Record<string, number>;
  /** Average duration by operation type */
  averageDurationByType: Record<string, number>;
}

/**
 * MongoDB Performance Monitor implementation.
 */
export class MongoPerformanceMonitorImpl implements MongoPerformanceMonitor {
  private metrics: MongoPerformanceMetrics[] = [];
  private activeOperations = new Map<string, { startTime: number; operation: string; collection: string; metadata?: Record<string, any> }>();
  private config: MongoPerformanceConfig;

  constructor(config: Partial<MongoPerformanceConfig> = {}) {
    this.config = {
      enabled: true,
      detailed: true,
      slowQueryThreshold: 1000, // 1 second
      maxMetrics: 1000,
      ...config
    };
  }

  /**
   * Start timing an operation.
   */
  startOperation(operation: string, collection: string, metadata?: Record<string, any>): string {
    if (!this.config.enabled) return '';

    const operationId = `${operation}_${collection}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.activeOperations.set(operationId, {
      startTime: Date.now(),
      operation,
      collection,
      metadata
    });

    return operationId;
  }

  /**
   * End timing an operation.
   */
  endOperation(operationId: string, documentCount?: number, error?: Error): void {
    if (!this.config.enabled || !operationId) return;

    const activeOp = this.activeOperations.get(operationId);
    if (!activeOp) return;

    const { startTime, operation, collection, metadata } = activeOp;
    const duration = Date.now() - startTime;
    const success = !error;

    const metric: MongoPerformanceMetrics = {
      operation,
      collection,
      duration,
      documentCount,
      queryComplexity: this.estimateQueryComplexity(operation, metadata),
      success,
      error: error?.message,
      timestamp: new Date(startTime),
      metadata: this.config.detailed ? metadata : undefined
    };

    this.metrics.push(metric);

    // Keep only the latest metrics
    if (this.metrics.length > this.config.maxMetrics) {
      this.metrics = this.metrics.slice(-this.config.maxMetrics);
    }

    // Call custom metrics collector if provided
    if (this.config.metricsCollector) {
      this.config.metricsCollector(metric);
    }

    // Log slow queries
    if (duration > this.config.slowQueryThreshold) {
      console.warn(`Slow MongoDB operation detected: ${operation} on ${collection} took ${duration}ms`);
    }

    this.activeOperations.delete(operationId);
  }

  /**
   * Get all performance metrics.
   */
  getMetrics(): MongoPerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Get slow queries (above threshold).
   */
  getSlowQueries(): MongoPerformanceMetrics[] {
    return this.metrics.filter(metric => metric.duration > this.config.slowQueryThreshold);
  }

  /**
   * Clear all metrics.
   */
  clearMetrics(): void {
    this.metrics = [];
    this.activeOperations.clear();
  }

  /**
   * Get performance summary.
   */
  getSummary(): MongoPerformanceSummary {
    if (this.metrics.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        slowOperations: 0,
        errorRate: 0,
        operationsByType: {},
        averageDurationByType: {}
      };
    }

    const totalOperations = this.metrics.length;
    const totalDuration = this.metrics.reduce((sum, metric) => sum + metric.duration, 0);
    const averageDuration = totalDuration / totalOperations;
    const slowOperations = this.metrics.filter(metric => metric.duration > this.config.slowQueryThreshold).length;
    const errorCount = this.metrics.filter(metric => !metric.success).length;
    const errorRate = (errorCount / totalOperations) * 100;

    // Group by operation type
    const operationsByType: Record<string, number> = {};
    const durationByType: Record<string, number[]> = {};

    this.metrics.forEach(metric => {
      operationsByType[metric.operation] = (operationsByType[metric.operation] || 0) + 1;
      if (!durationByType[metric.operation]) {
        durationByType[metric.operation] = [];
      }
      durationByType[metric.operation].push(metric.duration);
    });

    // Calculate average duration by type
    const averageDurationByType: Record<string, number> = {};
    Object.entries(durationByType).forEach(([operation, durations]) => {
      averageDurationByType[operation] = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
    });

    return {
      totalOperations,
      averageDuration,
      slowOperations,
      errorRate,
      operationsByType,
      averageDurationByType
    };
  }

  /**
   * Estimate query complexity based on operation type and metadata.
   */
  private estimateQueryComplexity(operation: string, metadata?: Record<string, any>): 'simple' | 'complex' | 'aggregation' {
    if (operation === 'aggregate') return 'aggregation';
    if (operation === 'find' && metadata?.hasWhere) return 'complex';
    if (operation === 'update' && metadata?.isUpdateMany) return 'complex';
    if (operation === 'delete' && metadata?.isDeleteMany) return 'complex';
    return 'simple';
  }
}

/**
 * Blank performance monitor that does nothing - used when performance monitoring is disabled.
 */
export class BlankPerformanceMonitor implements MongoPerformanceMonitor {
  startOperation(): string {
    return '';
  }

  endOperation(): void {
    // Do nothing
  }

  getMetrics(): MongoPerformanceMetrics[] {
    return [];
  }

  getSlowQueries(): MongoPerformanceMetrics[] {
    return [];
  }

  clearMetrics(): void {
    // Do nothing
  }

  getSummary(): MongoPerformanceSummary {
    return {
      totalOperations: 0,
      averageDuration: 0,
      slowOperations: 0,
      errorRate: 0,
      operationsByType: {},
      averageDurationByType: {}
    };
  }
}

/**
 * Performance monitoring decorator for MongoDB operations.
 */
export function withPerformanceMonitoring<T extends any[], R>(
  monitor: MongoPerformanceMonitor,
  operation: string,
  collection: string
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: T): Promise<R> {
      const operationId = monitor.startOperation(operation, collection, {
        method: propertyName,
        argsCount: args.length
      });

      try {
        const result = await method.apply(this, args);
        const documentCount = this.getDocumentCount?.(result) || undefined;
        monitor.endOperation(operationId, documentCount);
        return result;
      } catch (error) {
        monitor.endOperation(operationId, undefined, error as Error);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Performance monitoring mixin for MongoDB sources.
 */
export function withPerformanceMonitoringMixin<T extends new (...args: any[]) => any>(Base: T) {
  return class extends Base {
    public performanceMonitor: MongoPerformanceMonitor;

    constructor(...args: any[]) {
      super(...args);
      this.performanceMonitor = new MongoPerformanceMonitorImpl();
    }

    /**
     * Get performance metrics.
     */
    getPerformanceMetrics(): MongoPerformanceMetrics[] {
      return this.performanceMonitor.getMetrics();
    }

    /**
     * Get performance summary.
     */
    getPerformanceSummary(): MongoPerformanceSummary {
      return this.performanceMonitor.getSummary();
    }

    /**
     * Get slow queries.
     */
    getSlowQueries(): MongoPerformanceMetrics[] {
      return this.performanceMonitor.getSlowQueries();
    }

    /**
     * Clear performance metrics.
     */
    clearPerformanceMetrics(): void {
      this.performanceMonitor.clearMetrics();
    }

    /**
     * Get document count from result.
     */
    public getDocumentCount(result: any): number | undefined {
      if (Array.isArray(result)) return result.length;
      if (result && typeof result === 'object') {
        if ('matchedCount' in result) return result.matchedCount;
        if ('insertedCount' in result) return result.insertedCount;
        if ('deletedCount' in result) return result.deletedCount;
        if ('modifiedCount' in result) return result.modifiedCount;
      }
      return undefined;
    }
  };
}
