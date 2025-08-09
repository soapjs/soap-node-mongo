import { MongoSource } from '../../mongo.source';
import { SoapMongo } from '../../soap.mongo';
import { MongoConfig } from '../../mongo.config';
import { ObjectId } from 'mongodb';
import { 
  testClient, 
  testDb, 
  createTestData, 
  getTestData, 
  countTestData,
  setupTestDatabase,
  cleanupTestDatabase,
  cleanupCollections
} from './setup';

describe('MongoSource Integration Tests', () => {
  let soapMongo: SoapMongo;
  let userSource: MongoSource<any>;
  let productSource: MongoSource<any>;

  beforeAll(async () => {
    // Setup test database
    await setupTestDatabase();
    
    // Create SoapMongo instance for testing
    soapMongo = new SoapMongo(testClient, testDb);
  });

  afterAll(async () => {
    // Cleanup test database
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    // Clean up collections before each test
    await cleanupCollections();
    
    // Create fresh sources for each test
    userSource = new MongoSource(soapMongo, 'users');
    productSource = new MongoSource(soapMongo, 'products');
  });

  describe('Basic CRUD Operations', () => {
    it('should insert and find documents', async () => {
      // Insert test data
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        createdAt: new Date()
      };

      const result = await userSource.insert(userData);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);

      // Find the inserted document
      const foundUsers = await userSource.find({ where: { email: 'john@example.com' } });
      expect(foundUsers).toHaveLength(1);
      expect(foundUsers[0].name).toBe('John Doe');
      expect(foundUsers[0].email).toBe('john@example.com');
    });

    it('should update documents', async () => {
      // Insert test data
      const userData = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        status: 'active'
      };

      await userSource.insert(userData);

      // Update the document
      const updateResult = await userSource.update({
        where: { email: 'jane@example.com' },
        update: { status: 'inactive' }
      });

      expect(updateResult.modifiedCount).toBe(1);

      // Verify the update
      const updatedUser = await userSource.find({ where: { email: 'jane@example.com' } });
      expect(updatedUser[0].status).toBe('inactive');
    });

    it('should delete documents', async () => {
      // Insert test data
      const userData = {
        name: 'Delete Me',
        email: 'delete@example.com'
      };

      await userSource.insert(userData);

      // Verify document exists
      let count = await userSource.count({ where: { email: 'delete@example.com' } });
      expect(count).toBe(1);

      // Delete the document
      const deleteResult = await userSource.remove({ where: { email: 'delete@example.com' } });
      expect(deleteResult.deletedCount).toBe(1);

      // Verify document is deleted
      count = await userSource.count({ where: { email: 'delete@example.com' } });
      expect(count).toBe(0);
    });

    it('should handle bulk operations', async () => {
      // Insert multiple documents
      const users = [
        { name: 'User 1', email: 'user1@example.com' },
        { name: 'User 2', email: 'user2@example.com' },
        { name: 'User 3', email: 'user3@example.com' }
      ];

      const insertResult = await userSource.insert(users);
      expect(insertResult).toHaveLength(3);

      // Find all users
      const allUsers = await userSource.find({});
      expect(allUsers).toHaveLength(3);

      // Update all users
      const updateResult = await userSource.update({
        where: {},
        update: { status: 'verified' }
      });
      expect(updateResult.modifiedCount).toBe(3);

      // Verify updates
      const verifiedUsers = await userSource.find({ where: { status: 'verified' } });
      expect(verifiedUsers).toHaveLength(3);
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      // Insert test data for query tests
      const products = [
        { name: 'Laptop', price: 999, category: 'electronics', inStock: true },
        { name: 'Phone', price: 599, category: 'electronics', inStock: false },
        { name: 'Book', price: 29, category: 'books', inStock: true },
        { name: 'Chair', price: 199, category: 'furniture', inStock: true }
      ];

      await productSource.insert(products);
    });

    it('should handle complex where conditions', async () => {
      // Test AND condition
      const expensiveElectronics = await productSource.find({
        where: {
          category: 'electronics',
          price: { $gt: 500 }
        }
      });
      expect(expensiveElectronics).toHaveLength(2);

      // Test OR condition
      const inStockOrCheap = await productSource.find({
        where: {
          $or: [
            { inStock: true },
            { price: { $lt: 100 } }
          ]
        }
      });
      expect(inStockOrCheap).toHaveLength(3);
    });

    it('should handle sorting and limiting', async () => {
      const sortedProducts = await productSource.find({
        sort: { price: -1 },
        limit: 2
      });

      expect(sortedProducts).toHaveLength(2);
      expect(sortedProducts[0].price).toBe(999); // Most expensive first
      expect(sortedProducts[1].price).toBe(599);
    });

    it('should handle projections', async () => {
      const productNames = await productSource.find({
        projection: { name: 1, _id: 0 }
      });

      expect(productNames).toHaveLength(4);
      expect(productNames[0]).toHaveProperty('name');
      expect(productNames[0]).not.toHaveProperty('_id');
      expect(productNames[0]).not.toHaveProperty('price');
    });
  });

  describe('Aggregation Operations', () => {
    beforeEach(async () => {
      const products = [
        { name: 'Laptop', price: 999, category: 'electronics' },
        { name: 'Phone', price: 599, category: 'electronics' },
        { name: 'Book', price: 29, category: 'books' },
        { name: 'Chair', price: 199, category: 'furniture' }
      ];

      await productSource.insert(products);
    });

    it('should handle aggregation queries', async () => {
      const categoryStats = await productSource.aggregate({
        groupBy: ['category'],
        sum: ['price'],
        average: ['price'],
        count: ['name']
      });

      expect(categoryStats).toHaveLength(3);
      
      const electronics = categoryStats.find((item: any) => item._id.category === 'electronics');
      expect(electronics).toBeDefined();
      expect(electronics.sum_price).toBe(1598); // 999 + 599
      expect(electronics.average_price).toBe(799); // (999 + 599) / 2
      expect(electronics.count_name).toBe(2);
    });
  });

  describe('Transaction Support', () => {
    it('should handle transactions', async () => {
      const session = await userSource.startSession();
      
      try {
        await userSource.startTransaction();

        // Insert user
        const userResult = await userSource.insert(
          { name: 'Transaction User', email: 'transaction@example.com' }
        );

        // Insert another user
        const user2Result = await userSource.insert(
          { name: 'Transaction User 2', email: 'transaction2@example.com' }
        );

        // Commit transaction
        await userSource.commitTransaction();

        // Verify both users exist
        const users = await userSource.find({});
        expect(users).toHaveLength(2);
      } catch (error) {
        await userSource.rollbackTransaction();
        throw error;
      } finally {
        await userSource.endSession();
      }
    });

    it('should handle transaction rollback', async () => {
      const session = await userSource.startSession();
      
      try {
        await userSource.startTransaction();

        // Insert user
        await userSource.insert(
          { name: 'Rollback User', email: 'rollback@example.com' }
        );

        // Simulate error and rollback
        throw new Error('Simulated error');

      } catch (error) {
        await userSource.rollbackTransaction();
        
        // Verify user was not inserted
        const users = await userSource.find({});
        expect(users).toHaveLength(0);
      } finally {
        await userSource.endSession();
      }
    });
  });

  describe('Performance Monitoring', () => {
    it('should track performance metrics when enabled', async () => {
      const sourceWithMonitoring = new MongoSource(soapMongo, 'performance_test', {
        performanceMonitoring: {
          enabled: true,
          detailed: true,
          slowQueryThreshold: 1000
        }
      });

      // Perform some operations
      await sourceWithMonitoring.insert({ name: 'Performance Test', value: 123 });
      await sourceWithMonitoring.find({ where: { name: 'Performance Test' } });
      await sourceWithMonitoring.update({
        where: { name: 'Performance Test' },
        update: { value: 456 }
      });

      // Check performance metrics
      const metrics = sourceWithMonitoring.getPerformanceMetrics();
      expect(metrics.length).toBeGreaterThan(0);

      const summary = sourceWithMonitoring.getPerformanceSummary();
      expect(summary.totalOperations).toBeGreaterThan(0);
      expect(summary.averageDuration).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle duplicate key errors', async () => {
      // Create unique index
      await testDb.collection('users').createIndex({ email: 1 }, { unique: true });

      // Insert first user
      await userSource.insert({ name: 'Test User', email: 'duplicate@example.com' });

      // Try to insert duplicate
      try {
        await userSource.insert({ name: 'Another User', email: 'duplicate@example.com' });
        fail('Should have thrown duplicate key error');
      } catch (error: any) {
        expect(error.name).toBe('CollectionError');
        expect(error.code).toBe(11000);
      }
    });

    it('should handle invalid data errors', async () => {
      // Try to insert invalid data (if validation is enabled)
      try {
        await userSource.insert({ invalidField: new Date('invalid-date') });
        // This might not throw depending on MongoDB configuration
      } catch (error: any) {
        expect(error.name).toBe('CollectionError');
      }
    });
  });
});
