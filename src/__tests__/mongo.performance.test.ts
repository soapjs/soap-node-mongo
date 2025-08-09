import { 
  MongoPerformanceMonitorImpl, 
  MongoPerformanceMetrics, 
  MongoPerformanceSummary,
  MongoPerformanceConfig 
} from '../mongo.performance';

describe('MongoPerformanceMonitorImpl', () => {
  let monitor: MongoPerformanceMonitorImpl;

  beforeEach(() => {
    monitor = new MongoPerformanceMonitorImpl({
      enabled: true,
      detailed: true,
      slowQueryThreshold: 1000,
      maxMetrics: 100
    });
  });

  describe('startOperation', () => {
    it('should start timing an operation', () => {
      const operationId = monitor.startOperation('find', 'users', { test: true });
      
      expect(operationId).toBeTruthy();
      expect(typeof operationId).toBe('string');
    });

    it('should return empty string when disabled', () => {
      const disabledMonitor = new MongoPerformanceMonitorImpl({ enabled: false });
      const operationId = disabledMonitor.startOperation('find', 'users');
      
      expect(operationId).toBe('');
    });
  });

  describe('endOperation', () => {
    it('should end timing an operation successfully', () => {
      const operationId = monitor.startOperation('find', 'users');
      
      monitor.endOperation(operationId, 5);

      const metrics = monitor.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].operation).toBe('find');
      expect(metrics[0].collection).toBe('users');
      expect(metrics[0].documentCount).toBe(5);
      expect(metrics[0].success).toBe(true);
    });

    it('should handle operation with error', () => {
      const operationId = monitor.startOperation('find', 'users');
      const error = new Error('Database connection failed');
      
      monitor.endOperation(operationId, undefined, error);

      const metrics = monitor.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].success).toBe(false);
      expect(metrics[0].error).toBe('Database connection failed');
    });

    it('should not record metrics when disabled', () => {
      const disabledMonitor = new MongoPerformanceMonitorImpl({ enabled: false });
      const operationId = disabledMonitor.startOperation('find', 'users');
      
      disabledMonitor.endOperation(operationId, 5);
      
      const metrics = disabledMonitor.getMetrics();
      expect(metrics).toHaveLength(0);
    });
  });

  describe('getMetrics', () => {
    it('should return all recorded metrics', () => {
      const operationId1 = monitor.startOperation('find', 'users');
      monitor.endOperation(operationId1, 5);

      const operationId2 = monitor.startOperation('insert', 'users');
      monitor.endOperation(operationId2, 1);

      const metrics = monitor.getMetrics();
      expect(metrics).toHaveLength(2);
      expect(metrics[0].operation).toBe('find');
      expect(metrics[1].operation).toBe('insert');
    });

    it('should return copy of metrics array', () => {
      const operationId = monitor.startOperation('find', 'users');
      monitor.endOperation(operationId, 5);

      const metrics1 = monitor.getMetrics();
      const metrics2 = monitor.getMetrics();

      expect(metrics1).not.toBe(metrics2);
      expect(metrics1).toEqual(metrics2);
    });
  });

  describe('getSlowQueries', () => {
    it('should return only slow queries', () => {
      const slowMonitor = new MongoPerformanceMonitorImpl({
        enabled: true,
        slowQueryThreshold: 50 // Very low threshold for testing
      });
      
      // Fast operation
      const fastOperationId = slowMonitor.startOperation('find', 'users');
      slowMonitor.endOperation(fastOperationId, 5);

      // Slow operation - we need to actually wait
      const slowOperationId = slowMonitor.startOperation('aggregate', 'users');
      
      // Simulate slow operation by adding a small delay
      const startTime = Date.now();
      while (Date.now() - startTime < 60) {
        // Busy wait to simulate slow operation
      }
      
      slowMonitor.endOperation(slowOperationId, 100);

      const slowQueries = slowMonitor.getSlowQueries();
      expect(slowQueries).toHaveLength(1);
      expect(slowQueries[0].operation).toBe('aggregate');
    });
  });

  describe('clearMetrics', () => {
    it('should clear all metrics', () => {
      const operationId = monitor.startOperation('find', 'users');
      monitor.endOperation(operationId, 5);

      expect(monitor.getMetrics()).toHaveLength(1);

      monitor.clearMetrics();
      expect(monitor.getMetrics()).toHaveLength(0);
    });
  });

  describe('getSummary', () => {
    it('should return correct summary statistics', () => {
      // Add some test metrics
      const operationId1 = monitor.startOperation('find', 'users');
      monitor.endOperation(operationId1, 5);

      const operationId2 = monitor.startOperation('insert', 'users');
      monitor.endOperation(operationId2, 1);

      const operationId3 = monitor.startOperation('update', 'users');
      monitor.endOperation(operationId3, 3);

      const summary = monitor.getSummary();

      expect(summary.totalOperations).toBe(3);
      expect(summary.operationsByType).toEqual({
        find: 1,
        insert: 1,
        update: 1
      });
      expect(summary.errorRate).toBe(0);
      expect(summary.slowOperations).toBe(0);
    });

    it('should handle empty metrics', () => {
      const summary = monitor.getSummary();

      expect(summary.totalOperations).toBe(0);
      expect(summary.averageDuration).toBe(0);
      expect(summary.slowOperations).toBe(0);
      expect(summary.errorRate).toBe(0);
      expect(summary.operationsByType).toEqual({});
      expect(summary.averageDurationByType).toEqual({});
    });

    it('should calculate error rate correctly', () => {
      const operationId1 = monitor.startOperation('find', 'users');
      monitor.endOperation(operationId1, 5);

      const operationId2 = monitor.startOperation('find', 'users');
      monitor.endOperation(operationId2, undefined, new Error('Test error'));

      const summary = monitor.getSummary();
      expect(summary.errorRate).toBe(50);
    });
  });

  describe('maxMetrics limit', () => {
    it('should limit the number of stored metrics', () => {
      const limitedMonitor = new MongoPerformanceMonitorImpl({
        enabled: true,
        maxMetrics: 2
      });

      // Add 3 operations
      for (let i = 0; i < 3; i++) {
        const operationId = limitedMonitor.startOperation('find', 'users');
        limitedMonitor.endOperation(operationId, i);
      }

      const metrics = limitedMonitor.getMetrics();
      expect(metrics).toHaveLength(2);
      // Should keep the latest metrics
      expect(metrics[0].documentCount).toBe(1);
      expect(metrics[1].documentCount).toBe(2);
    });
  });

  describe('custom metrics collector', () => {
    it('should call custom metrics collector', () => {
      const collectedMetrics: MongoPerformanceMetrics[] = [];
      
      const customMonitor = new MongoPerformanceMonitorImpl({
        enabled: true,
        metricsCollector: (metrics) => {
          collectedMetrics.push(metrics);
        }
      });

      const operationId = customMonitor.startOperation('find', 'users');
      customMonitor.endOperation(operationId, 5);

      expect(collectedMetrics).toHaveLength(1);
      expect(collectedMetrics[0].operation).toBe('find');
      expect(collectedMetrics[0].collection).toBe('users');
      expect(collectedMetrics[0].documentCount).toBe(5);
    });
  });

  describe('query complexity estimation', () => {
    it('should estimate query complexity correctly', () => {
      const operationId1 = monitor.startOperation('find', 'users', { hasWhere: true });
      monitor.endOperation(operationId1, 5);

      const operationId2 = monitor.startOperation('aggregate', 'users');
      monitor.endOperation(operationId2, 10);

      const operationId3 = monitor.startOperation('find', 'users');
      monitor.endOperation(operationId3, 1);

      const metrics = monitor.getMetrics();
      expect(metrics[0].queryComplexity).toBe('complex');
      expect(metrics[1].queryComplexity).toBe('aggregation');
      expect(metrics[2].queryComplexity).toBe('simple');
    });
  });
});
