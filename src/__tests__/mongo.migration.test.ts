import { 
  MongoMigrationManager, 
  BaseMigration, 
  MongoMigration,
  MigrationConfig 
} from '../mongo.migration';
import { SoapMongo } from '../soap.mongo';
import { MongoConfig } from '../mongo.config';
import * as mongoDb from 'mongodb';

// Mock SoapMongo
jest.mock('../soap.mongo');
jest.mock('../mongo.config');

describe('MongoMigrationManager', () => {
  let migrationManager: MongoMigrationManager;
  let mockDatabase: any;
  let mockCollection: any;
  let mockSoapMongo: any;

  beforeEach(() => {
    // Mock database and collection
    mockCollection = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([])
        })
      }),
      findOne: jest.fn().mockResolvedValue(null),
      insertOne: jest.fn().mockResolvedValue({ insertedId: 'test-id' }),
      deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      createIndex: jest.fn().mockResolvedValue({}),
      dropIndex: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      dropCollection: jest.fn().mockResolvedValue({})
    };

    mockDatabase = {
      collection: jest.fn().mockReturnValue(mockCollection),
      createCollection: jest.fn().mockResolvedValue({}),
      dropCollection: jest.fn().mockResolvedValue({}),
      listCollections: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([])
      })
    };

    mockSoapMongo = {
      database: mockDatabase
    };

    migrationManager = new MongoMigrationManager(mockSoapMongo, {
      collectionName: 'migrations',
      autoRun: false,
      validateBeforeRun: true,
      maxBatchSize: 10
    });
  });

  describe('register', () => {
    it('should register a migration', () => {
      const migration = new TestMigration();
      migrationManager.register(migration);
      
      const migrations = migrationManager.getMigrations();
      expect(migrations).toHaveLength(1);
      expect(migrations[0]).toBe(migration);
    });

    it('should register multiple migrations', () => {
      const migration1 = new TestMigration();
      const migration2 = new TestMigration2();
      
      migrationManager.registerMany([migration1, migration2]);
      
      const migrations = migrationManager.getMigrations();
      expect(migrations).toHaveLength(2);
    });
  });

  describe('getMigrationStatus', () => {
    it('should return migration status from database', async () => {
      const mockStatus = [
        { id: 'test-1', version: 1, applied: true, appliedAt: new Date() }
      ];
      
      mockCollection.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue(mockStatus)
        })
      });

      const status = await migrationManager.getMigrationStatus();
      expect(status).toEqual(mockStatus);
    });
  });

  describe('isMigrationApplied', () => {
    it('should return true if migration is applied', async () => {
      mockCollection.findOne.mockResolvedValue({
        id: 'test-1',
        applied: true
      });

      const isApplied = await migrationManager.isMigrationApplied('test-1');
      expect(isApplied).toBe(true);
    });

    it('should return false if migration is not applied', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      const isApplied = await migrationManager.isMigrationApplied('test-1');
      expect(isApplied).toBe(false);
    });
  });

  describe('migrate', () => {
    it('should run pending migrations', async () => {
      const migration = new TestMigration();
      migrationManager.register(migration);

      const result = await migrationManager.migrate();
      
      expect(result.success).toBe(true);
      expect(result.appliedCount).toBe(1);
      expect(result.failedCount).toBe(0);
    });

    it('should skip already applied migrations', async () => {
      const migration = new TestMigration();
      migrationManager.register(migration);

      // Mock that migration is already applied
      mockCollection.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            { id: 'test-migration', version: 1, applied: true }
          ])
        })
      });

      const result = await migrationManager.migrate();
      
      expect(result.success).toBe(true);
      expect(result.skippedCount).toBe(1);
      expect(result.appliedCount).toBe(0);
    });
  });

  describe('rollback', () => {
    it('should rollback the last migration', async () => {
      const migration = new TestMigration();
      migrationManager.register(migration);

      // Mock that migration is applied
      const mockAppliedMigration = { id: 'test-migration', version: 1, applied: true };
      
      mockCollection.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([mockAppliedMigration])
        })
      });

      const result = await migrationManager.rollback();
      
      expect(result.success).toBe(true);
      expect(result.appliedCount).toBe(1);
      expect(mockCollection.deleteOne).toHaveBeenCalledWith({ id: 'test-migration' });
    });

    it('should handle non-reversible migrations', async () => {
      const migration = new NonReversibleMigration();
      migrationManager.register(migration);

      // Mock that migration is applied
      const mockAppliedMigration = { id: 'non-reversible', version: 1, applied: true };
      
      mockCollection.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([mockAppliedMigration])
        })
      });

      const result = await migrationManager.rollback();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not reversible');
    });
  });
});

// Test migration classes
class TestMigration extends BaseMigration {
  id = 'test-migration';
  version = 1;
  description = 'Test migration';
  reversible = true;

  async up(database: mongoDb.Db): Promise<void> {
    const collection = database.collection('test');
    await collection.createIndex({ test: 1 });
  }

  async down(database: mongoDb.Db): Promise<void> {
    const collection = database.collection('test');
    await collection.dropIndex('test_1');
  }
}

class TestMigration2 extends BaseMigration {
  id = 'test-migration-2';
  version = 2;
  description = 'Test migration 2';
  reversible = true;

  async up(database: mongoDb.Db): Promise<void> {
    const collection = database.collection('test');
    await collection.updateMany({}, { $set: { status: 'active' } });
  }

  async down(database: mongoDb.Db): Promise<void> {
    const collection = database.collection('test');
    await collection.updateMany({}, { $unset: { status: '' } });
  }
}

class NonReversibleMigration extends BaseMigration {
  id = 'non-reversible';
  version = 3;
  description = 'Non-reversible migration';
  reversible = false;

  async up(database: mongoDb.Db): Promise<void> {
    const collection = database.collection('test');
    await collection.createIndex({ test: 1 });
  }
}
