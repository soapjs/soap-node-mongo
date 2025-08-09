import * as mongoDb from "mongodb";
import { SoapMongo } from "./soap.mongo";

/**
 * Migration interface that all migrations must implement.
 */
export interface MongoMigration {
  /** Unique identifier for the migration */
  id: string;
  /** Version number for ordering migrations */
  version: number;
  /** Description of what the migration does */
  description: string;
  /** Timestamp when migration was created */
  createdAt: Date;
  /** Whether the migration is reversible */
  reversible: boolean;
  /** Execute the migration */
  up(database: mongoDb.Db): Promise<void>;
  /** Rollback the migration (if reversible) */
  down?(database: mongoDb.Db): Promise<void>;
}

/**
 * Migration status in the database.
 */
export interface MigrationStatus {
  /** Migration ID */
  id: string;
  /** Migration version */
  version: number;
  /** Whether migration was applied */
  applied: boolean;
  /** When migration was applied */
  appliedAt?: Date;
  /** Error message if migration failed */
  error?: string;
}

/**
 * Migration configuration.
 */
export interface MigrationConfig {
  /** Collection name for storing migration status */
  collectionName?: string;
  /** Whether to run migrations automatically */
  autoRun?: boolean;
  /** Whether to validate migrations before running */
  validateBeforeRun?: boolean;
  /** Maximum number of migrations to run in one batch */
  maxBatchSize?: number;
}

/**
 * Migration result.
 */
export interface MigrationResult {
  /** Whether migration was successful */
  success: boolean;
  /** Number of migrations applied */
  appliedCount: number;
  /** Number of migrations skipped */
  skippedCount: number;
  /** Number of migrations failed */
  failedCount: number;
  /** Applied migrations */
  applied: MigrationStatus[];
  /** Failed migrations */
  failed: MigrationStatus[];
  /** Error message if any */
  error?: string;
}

/**
 * MongoDB Migration Manager.
 */
export class MongoMigrationManager {
  private readonly collectionName: string;
  private readonly database: mongoDb.Db;
  private readonly migrations: MongoMigration[] = [];

  constructor(
    private readonly soapMongo: SoapMongo,
    private readonly config: MigrationConfig = {}
  ) {
    this.database = soapMongo.database;
    this.collectionName = config.collectionName || 'migrations';
  }

  /**
   * Register a migration.
   */
  register(migration: MongoMigration): void {
    this.migrations.push(migration);
  }

  /**
   * Register multiple migrations.
   */
  registerMany(migrations: MongoMigration[]): void {
    this.migrations.push(...migrations);
  }

  /**
   * Get all registered migrations.
   */
  getMigrations(): MongoMigration[] {
    return [...this.migrations].sort((a, b) => a.version - b.version);
  }

  /**
   * Get migration status from database.
   */
  async getMigrationStatus(): Promise<MigrationStatus[]> {
    const collection = this.database.collection<MigrationStatus>(this.collectionName);
    return await collection.find().sort({ version: 1 }).toArray();
  }

  /**
   * Check if migration is applied.
   */
  async isMigrationApplied(migrationId: string): Promise<boolean> {
    const collection = this.database.collection<MigrationStatus>(this.collectionName);
    const status = await collection.findOne({ id: migrationId });
    return status?.applied || false;
  }

  /**
   * Run all pending migrations.
   */
  async migrate(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      appliedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      applied: [],
      failed: []
    };

    try {
      // Ensure migrations collection exists
      await this.ensureMigrationsCollection();

      const appliedMigrations = await this.getMigrationStatus();
      const appliedIds = new Set(appliedMigrations.map(m => m.id));
      
      const pendingMigrations = this.getMigrations().filter(m => !appliedIds.has(m.id));

      if (pendingMigrations.length === 0) {
        result.skippedCount = this.migrations.length;
        return result;
      }

      // Sort migrations by version
      pendingMigrations.sort((a, b) => a.version - b.version);

      // Validate migrations if enabled
      if (this.config.validateBeforeRun) {
        await this.validateMigrations(pendingMigrations);
      }

      // Run migrations in batches
      const batchSize = this.config.maxBatchSize || 10;
      for (let i = 0; i < pendingMigrations.length; i += batchSize) {
        const batch = pendingMigrations.slice(i, i + batchSize);
        const batchResult = await this.runMigrationBatch(batch);
        
        result.appliedCount += batchResult.appliedCount;
        result.failedCount += batchResult.failedCount;
        result.applied.push(...batchResult.applied);
        result.failed.push(...batchResult.failed);

        if (batchResult.failedCount > 0) {
          result.success = false;
          break;
        }
      }

    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  /**
   * Rollback the last migration.
   */
  async rollback(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      appliedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      applied: [],
      failed: []
    };

    try {
      const appliedMigrations = await this.getMigrationStatus();
      const lastMigration = appliedMigrations[appliedMigrations.length - 1];

      if (!lastMigration) {
        result.skippedCount = 1;
        return result;
      }

      const migration = this.migrations.find(m => m.id === lastMigration.id);
      if (!migration || !migration.reversible || !migration.down) {
        result.success = false;
        result.error = `Migration ${lastMigration.id} is not reversible`;
        return result;
      }

      await migration.down(this.database);
      
      // Remove migration status
      const collection = this.database.collection<MigrationStatus>(this.collectionName);
      await collection.deleteOne({ id: lastMigration.id });

      result.appliedCount = 1;
      result.applied.push({ ...lastMigration, applied: false });

    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  /**
   * Rollback to specific version.
   */
  async rollbackTo(version: number): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      appliedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      applied: [],
      failed: []
    };

    try {
      const appliedMigrations = await this.getMigrationStatus();
      const migrationsToRollback = appliedMigrations
        .filter(m => m.version > version)
        .sort((a, b) => b.version - a.version);

      for (const migrationStatus of migrationsToRollback) {
        const migration = this.migrations.find(m => m.id === migrationStatus.id);
        if (!migration || !migration.reversible || !migration.down) {
          result.failedCount++;
          result.failed.push({
            ...migrationStatus,
            error: 'Migration is not reversible'
          });
          continue;
        }

        try {
          await migration.down(this.database);
          
          // Remove migration status
          const collection = this.database.collection<MigrationStatus>(this.collectionName);
          await collection.deleteOne({ id: migrationStatus.id });

          result.appliedCount++;
          result.applied.push({ ...migrationStatus, applied: false });

        } catch (error) {
          result.failedCount++;
          result.failed.push({
            ...migrationStatus,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  /**
   * Ensure migrations collection exists.
   */
  private async ensureMigrationsCollection(): Promise<void> {
    const collections = await this.database.listCollections({ name: this.collectionName }).toArray();
    if (collections.length === 0) {
      await this.database.createCollection(this.collectionName);
    }
  }

  /**
   * Validate migrations before running.
   */
  private async validateMigrations(migrations: MongoMigration[]): Promise<void> {
    const versions = migrations.map(m => m.version);
    const duplicates = versions.filter((v, i) => versions.indexOf(v) !== i);
    
    if (duplicates.length > 0) {
      throw new Error(`Duplicate migration versions found: ${duplicates.join(', ')}`);
    }

    const appliedMigrations = await this.getMigrationStatus();
    const appliedVersions = appliedMigrations.map(m => m.version);
    
    for (const migration of migrations) {
      if (appliedVersions.includes(migration.version)) {
        throw new Error(`Migration version ${migration.version} already exists`);
      }
    }
  }

  /**
   * Run a batch of migrations.
   */
  private async runMigrationBatch(migrations: MongoMigration[]): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      appliedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      applied: [],
      failed: []
    };

    const collection = this.database.collection<MigrationStatus>(this.collectionName);

    for (const migration of migrations) {
      try {
        await migration.up(this.database);
        
        // Record migration as applied
        await collection.insertOne({
          id: migration.id,
          version: migration.version,
          applied: true,
          appliedAt: new Date()
        });

        result.appliedCount++;
        result.applied.push({
          id: migration.id,
          version: migration.version,
          applied: true,
          appliedAt: new Date()
        });

      } catch (error) {
        result.failedCount++;
        result.failed.push({
          id: migration.id,
          version: migration.version,
          applied: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return result;
  }
}

/**
 * Base migration class for easier migration creation.
 */
export abstract class BaseMigration implements MongoMigration {
  abstract id: string;
  abstract version: number;
  abstract description: string;
  abstract reversible: boolean;

  createdAt: Date = new Date();

  abstract up(database: mongoDb.Db): Promise<void>;
  
  down?(database: mongoDb.Db): Promise<void>;
}
