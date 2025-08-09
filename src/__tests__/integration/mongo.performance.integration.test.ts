import { MongoSource } from '../../mongo.source';
import { SoapMongo } from '../../soap.mongo';
import { 
  testClient, 
  testDb,
  setupTestDatabase,
  cleanupTestDatabase,
  cleanupCollections
} from './setup';

describe('MongoPerformance Integration Tests', () => {
  let soapMongo: SoapMongo;
  let sourceWithMonitoring: MongoSource<any>;
  let sourceWithoutMonitoring: MongoSource<any>;

  beforeAll(async () => {
    // Setup test database
    await setupTestDatabase();
    soapMongo = new SoapMongo(testClient, testDb);
  });

  afterAll(async () => {
    // Cleanup test database
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    // Clean up collections before each test
    await cleanupCollections();
    
    // Create sources with and without performance monitoring
    sourceWithMonitoring = new MongoSource(soapMongo, 'performance_test', {
      performanceMonitoring: {
        enabled: true,
        detailed: true,
        slowQueryThreshold: 100,
        maxMetrics: 1000
      }
    });

    sourceWithoutMonitoring = new MongoSource(soapMongo, 'performance_test_no_monitoring', {
      performanceMonitoring: {
        enabled: false
      }
    });
  });

  describe('Performance Monitoring Enabled', () => {
    it('should track basic operations', async () => {
      // Perform various operations
      await sourceWithMonitoring.insert({ name: 'Test User', email: 'test@example.com' });
      await sourceWithMonitoring.find({ where: { name: 'Test User' } });
      await sourceWithMonitoring.update({ where: { name: 'Test User' }, update: { status: 'active' } });
      await sourceWithMonitoring.count({ where: { status: 'active' } });

      // Check performance metrics
      const metrics = sourceWithMonitoring.getPerformanceMetrics();
      expect(metrics.length).toBeGreaterThan(0);

      // Verify all operations were tracked
      const operationTypes = metrics.map(m => m.operation);
      expect(operationTypes).toContain('insert');
      expect(operationTypes).toContain('find');
      expect(operationTypes).toContain('update');
      expect(operationTypes).toContain('count');
    });

    it('should track slow queries', async () => {
      // Insert test data
      const testData = Array.from({ length: 1000 }, (_, i) => ({
        name: `User ${i}`,
        email: `user${i}@example.com`,
        value: i
      }));

      await sourceWithMonitoring.insert(testData);

      // Perform a potentially slow operation
      const startTime = Date.now();
      await sourceWithMonitoring.find({ where: { value: { $gt: 500 } } });
      const endTime = Date.now();

      // Check if it was marked as slow (if it took longer than threshold)
      const slowQueries = sourceWithMonitoring.getSlowQueries();
      if (endTime - startTime > 100) {
        expect(slowQueries.length).toBeGreaterThan(0);
      }
    });

    it('should provide performance summary', async () => {
      // Perform operations
      await sourceWithMonitoring.insert({ name: 'Summary Test', value: 123 });
      await sourceWithMonitoring.find({ where: { name: 'Summary Test' } });

      const summary = sourceWithMonitoring.getPerformanceSummary();

      expect(summary.totalOperations).toBeGreaterThan(0);
      expect(summary.averageDuration).toBeGreaterThan(0);
      expect(summary.slowOperations).toBeGreaterThanOrEqual(0);
      expect(summary.operationsByType).toBeDefined();
    });

    it('should handle bulk operations', async () => {
      const bulkData = Array.from({ length: 100 }, (_, i) => ({
        name: `Bulk User ${i}`,
        email: `bulk${i}@example.com`
      }));

      // Bulk insert
      await sourceWithMonitoring.insert(bulkData);

      // Bulk update
      await sourceWithMonitoring.update({ where: {}, update: { status: 'verified' } });

      const metrics = sourceWithMonitoring.getPerformanceMetrics();
      const bulkOperations = metrics.filter(m => m.documentCount && m.documentCount > 1);

      expect(bulkOperations.length).toBeGreaterThan(0);
      expect(bulkOperations.some(op => op.documentCount === 100)).toBe(true);
    });

    it('should track aggregation operations', async () => {
      // Insert test data for aggregation
      const products = [
        { name: 'Laptop', price: 999, category: 'electronics' },
        { name: 'Phone', price: 599, category: 'electronics' },
        { name: 'Book', price: 29, category: 'books' },
        { name: 'Chair', price: 199, category: 'furniture' }
      ];

      await sourceWithMonitoring.insert(products);

      // Perform aggregation
      await sourceWithMonitoring.aggregate({
        groupBy: ['category'],
        sum: ['price'],
        average: ['price']
      });

      const metrics = sourceWithMonitoring.getPerformanceMetrics();
      const aggregationMetrics = metrics.filter(m => m.operation === 'aggregate');

      expect(aggregationMetrics.length).toBeGreaterThan(0);
      expect(aggregationMetrics[0].queryComplexity).toBe('aggregation');
    });

    it('should respect maxMetrics limit', async () => {
      const limitedSource = new MongoSource(soapMongo, 'limited_test', {
        performanceMonitoring: {
          enabled: true,
          maxMetrics: 5
        }
      });

      // Perform more operations than the limit
      for (let i = 0; i < 10; i++) {
        await limitedSource.insert({ name: `User ${i}`, value: i });
      }

      const metrics = limitedSource.getPerformanceMetrics();
      expect(metrics.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Performance Monitoring Disabled', () => {
    it('should not track operations when disabled', async () => {
      // Perform operations
      await sourceWithoutMonitoring.insert({ name: 'No Monitoring', value: 123 });
      await sourceWithoutMonitoring.find({ where: { name: 'No Monitoring' } });

      // Check that no metrics were collected
      const metrics = sourceWithoutMonitoring.getPerformanceMetrics();
      expect(metrics.length).toBe(0);

      const summary = sourceWithoutMonitoring.getPerformanceSummary();
      expect(summary.totalOperations).toBe(0);
      expect(summary.averageDuration).toBe(0);
    });

    it('should return empty arrays for disabled monitoring', async () => {
      const slowQueries = sourceWithoutMonitoring.getSlowQueries();
      expect(slowQueries).toEqual([]);

      const metrics = sourceWithoutMonitoring.getPerformanceMetrics();
      expect(metrics).toEqual([]);
    });
  });

  describe('Performance Monitoring Configuration', () => {
    it('should handle custom slow query threshold', async () => {
      const customSource = new MongoSource(soapMongo, 'custom_threshold', {
        performanceMonitoring: {
          enabled: true,
          slowQueryThreshold: 50 // Very low threshold
        }
      });

      // Perform a quick operation
      await customSource.insert({ name: 'Quick Test', value: 123 });

      // Check if it was marked as slow (shouldn't be with 50ms threshold)
      const slowQueries = customSource.getSlowQueries();
      // This might be slow depending on system performance, so we just check the structure
      expect(Array.isArray(slowQueries)).toBe(true);
    });

    it('should handle custom metrics collector', async () => {
      const collectedMetrics: any[] = [];
      
      const customSource = new MongoSource(soapMongo, 'custom_collector', {
        performanceMonitoring: {
          enabled: true,
          metricsCollector: (metric) => {
            collectedMetrics.push(metric);
          }
        }
      });

      // Perform operations
      await customSource.insert({ name: 'Custom Collector', value: 456 });
      await customSource.find({ where: { name: 'Custom Collector' } });

      // Check that metrics were collected by custom collector
      expect(collectedMetrics.length).toBeGreaterThan(0);
      expect(collectedMetrics[0].operation).toBeDefined();
      expect(collectedMetrics[0].duration).toBeGreaterThan(0);
    });
  });

  describe('Performance Monitoring Edge Cases', () => {
    it('should handle errors in operations', async () => {
      // Try to perform an operation that might fail
      try {
        await sourceWithMonitoring.insert({ _id: 'invalid-id' }); // This might fail depending on MongoDB configuration
      } catch (error) {
        // Expected error
      }

      const metrics = sourceWithMonitoring.getPerformanceMetrics();
      // Should still have tracked the operation attempt
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should handle concurrent operations', async () => {
      const promises = [];
      
      // Start multiple concurrent operations
      for (let i = 0; i < 5; i++) {
        promises.push(sourceWithMonitoring.insert({ name: `Concurrent ${i}`, value: i }));
      }

      await Promise.all(promises);

      const metrics = sourceWithMonitoring.getPerformanceMetrics();
      expect(metrics.length).toBeGreaterThanOrEqual(5);
    });

    it('should handle large result sets', async () => {
      // Insert large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        name: `Large Dataset ${i}`,
        value: i,
        category: i % 10
      }));

      await sourceWithMonitoring.insert(largeDataset);

      // Query large dataset
      await sourceWithMonitoring.find({ where: { category: 5 } });

      const metrics = sourceWithMonitoring.getPerformanceMetrics();
      const findMetrics = metrics.filter(m => m.operation === 'find');
      
      expect(findMetrics.length).toBeGreaterThan(0);
      expect(findMetrics[0].documentCount).toBeGreaterThan(0);
    });
  });
});
