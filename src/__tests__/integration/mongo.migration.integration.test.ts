import { MongoMigrationManager, BaseMigration, MongoMigration } from '../../mongo.migration';
import { SoapMongo } from '../../soap.mongo';
import { 
  testClient, 
  testDb,
  setupTestDatabase,
  cleanupTestDatabase,
  cleanupCollections
} from './setup';
import * as mongoDb from 'mongodb';

describe('MongoMigration Integration Tests', () => {
  let soapMongo: SoapMongo;
  let migrationManager: MongoMigrationManager;

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
    
    // Create fresh migration manager for each test
    migrationManager = new MongoMigrationManager(soapMongo, {
      collectionName: 'migrations'
    });
  });

  describe('Migration Registration', () => {
    it('should register migrations', () => {
      const migration1 = new TestMigration1();
      const migration2 = new TestMigration2();

      migrationManager.register(migration1);
      migrationManager.register(migration2);

      const migrations = migrationManager.getMigrations();
      expect(migrations).toHaveLength(2);
      expect(migrations[0].id).toBe('test-migration-1');
      expect(migrations[1].id).toBe('test-migration-2');
    });

    it('should register multiple migrations at once', () => {
      const migrations = [
        new TestMigration1(),
        new TestMigration2()
      ];

      migrationManager.registerMany(migrations);

      const registeredMigrations = migrationManager.getMigrations();
      expect(registeredMigrations).toHaveLength(2);
    });
  });

  describe('Migration Execution', () => {
    it('should run migrations in order', async () => {
      const migration1 = new TestMigration1();
      const migration2 = new TestMigration2();

      migrationManager.register(migration1);
      migrationManager.register(migration2);

      const result = await migrationManager.migrate();

      expect(result.success).toBe(true);
      expect(result.appliedCount).toBe(2);

      // Verify migrations were applied
      const status = await migrationManager.getMigrationStatus();
      expect(status).toHaveLength(2);
      expect(status[0].applied).toBe(true);
      expect(status[1].applied).toBe(true);
    });

    it('should skip already applied migrations', async () => {
      const migration = new TestMigration1();
      migrationManager.register(migration);

      // Run migration first time
      const result1 = await migrationManager.migrate();
      expect(result1.appliedCount).toBe(1);

      // Run migration second time
      const result2 = await migrationManager.migrate();
      expect(result2.appliedCount).toBe(0);
      expect(result2.skippedCount).toBe(1);
    });

    it('should handle migration errors', async () => {
      const failingMigration = new FailingMigration();
      migrationManager.register(failingMigration);

      const result = await migrationManager.migrate();
      
      expect(result.success).toBe(false);
      expect(result.failedCount).toBe(1);
      expect(result.failed[0].error).toContain('Migration failed');

      // Verify migration was not applied
      const status = await migrationManager.getMigrationStatus();
      expect(status).toHaveLength(0);
    });
  });

  describe('Migration Rollback', () => {
    beforeEach(async () => {
      // Set up migrations
      const migration1 = new TestMigration1();
      const migration2 = new TestMigration2();
      migrationManager.register(migration1);
      migrationManager.register(migration2);

      // Apply migrations
      await migrationManager.migrate();
    });

    it('should rollback the last migration', async () => {
      const result = await migrationManager.rollback();

      expect(result.success).toBe(true);

      // Verify migration was rolled back
      const status = await migrationManager.getMigrationStatus();
      expect(status).toHaveLength(1);
      expect(status[0].applied).toBe(true); // First migration still applied
    });

    it('should rollback to specific version', async () => {
      const result = await migrationManager.rollbackTo(1);

      expect(result.success).toBe(true);

      // Verify only first migration is applied
      const status = await migrationManager.getMigrationStatus();
      expect(status).toHaveLength(1);
      expect(status[0].version).toBe(1);
    });

    it('should handle non-reversible migrations', async () => {
      const nonReversibleMigration = new NonReversibleMigration();
      migrationManager.register(nonReversibleMigration);

      // Apply the non-reversible migration
      await migrationManager.migrate();

      // Try to rollback
      const result = await migrationManager.rollback();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not reversible');
    });
  });

  describe('Migration Status', () => {
    it('should track migration status correctly', async () => {
      const migration = new TestMigration1();
      migrationManager.register(migration);

      // Check status before migration
      let status = await migrationManager.getMigrationStatus();
      expect(status).toHaveLength(0);

      // Apply migration
      await migrationManager.migrate();

      // Check status after migration
      status = await migrationManager.getMigrationStatus();
      expect(status).toHaveLength(1);
      expect(status[0].applied).toBe(true);
      expect(status[0].appliedAt).toBeDefined();
    });

    it('should check if migration is applied', async () => {
      const migration = new TestMigration1();
      migrationManager.register(migration);

      // Check before migration
      let isApplied = await migrationManager.isMigrationApplied('test-migration-1');
      expect(isApplied).toBe(false);

      // Apply migration
      await migrationManager.migrate();

      // Check after migration
      isApplied = await migrationManager.isMigrationApplied('test-migration-1');
      expect(isApplied).toBe(true);
    });
  });

  describe('Migration Validation', () => {
    it('should validate migration versions', () => {
      const migration1 = new TestMigration1();
      const migration3 = new TestMigration3(); // Same version as migration1

      migrationManager.register(migration1);

      expect(() => {
        migrationManager.register(migration3);
      }).toThrow('Migration with version 1 already exists. Duplicate version detected.');
    });
  });
});

// Test migration classes
class TestMigration1 extends BaseMigration {
  id = 'test-migration-1';
  version = 1;
  description = 'Test migration 1';
  reversible = true;

  async up(database: mongoDb.Db): Promise<void> {
    await database.collection('test_collection').insertOne({
      name: 'test1',
      createdAt: new Date()
    });
  }

  async down(database: mongoDb.Db): Promise<void> {
    await database.collection('test_collection').deleteOne({ name: 'test1' });
  }
}

class TestMigration2 extends BaseMigration {
  id = 'test-migration-2';
  version = 2;
  description = 'Test migration 2';
  reversible = true;

  async up(database: mongoDb.Db): Promise<void> {
    await database.collection('test_collection').insertOne({
      name: 'test2',
      createdAt: new Date()
    });
  }

  async down(database: mongoDb.Db): Promise<void> {
    await database.collection('test_collection').deleteOne({ name: 'test2' });
  }
}

class TestMigration3 extends BaseMigration {
  id = 'test-migration-3';
  version = 1; // Duplicate version
  description = 'Test migration 3';
  reversible = true;

  async up(database: mongoDb.Db): Promise<void> {
    await database.collection('test_collection').insertOne({
      name: 'test3',
      createdAt: new Date()
    });
  }

  async down(database: mongoDb.Db): Promise<void> {
    await database.collection('test_collection').deleteOne({ name: 'test3' });
  }
}

class FailingMigration extends BaseMigration {
  id = 'failing-migration';
  version = 1;
  description = 'Failing migration';
  reversible = false;

  async up(database: mongoDb.Db): Promise<void> {
    throw new Error('Migration failed');
  }
}

class NonReversibleMigration extends BaseMigration {
  id = 'non-reversible-migration';
  version = 3;
  description = 'Non-reversible migration';
  reversible = false;

  async up(database: mongoDb.Db): Promise<void> {
    await database.collection('test_collection').insertOne({
      name: 'non-reversible',
      createdAt: new Date()
    });
  }
}
