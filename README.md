# @soapjs/soap-node-mongo

This package provides MongoDB integration for the SoapJS framework, enabling seamless interaction with MongoDB databases and ensuring that your data access layer is clean, efficient, and scalable.

## Features

- **Clean Architecture Support**: Follows SoapJS clean architecture patterns with full abstraction support.
- **Type Safety**: Full TypeScript support with comprehensive type definitions.
- **Source Implementation**: Full implementation of Source interface for MongoDB.
- **Transaction Support**: Full support for MongoDB transactions and sessions with SOAPJS transaction system.
- **Query Builder**: Advanced query building with Where conditions and QueryBuilder support.
- **Field Mapping**: Flexible field mapping between domain entities and database documents.
- **Common Transformers**: Pre-built transformers for common MongoDB patterns (ObjectId, Date, etc.).
- **Performance Monitoring**: Optional built-in performance monitoring with metrics collection, slow query detection, and custom collectors.
- **Connection Pooling**: Advanced connection pool configuration with customizable settings for optimal performance.
- **Database Migrations**: Powerful migration system for managing database schema changes with rollback support.
- **Compatibility**: Support for various MongoDB versions with feature detection.
- **Error Handling**: Comprehensive error handling with specific MongoDB error types.

## Installation

Remember to have `mongodb` and `@soapjs/soap` installed in your project in which you want to use this package.

```bash
npm install @soapjs/soap-node-mongo
```

## Quick Start

### 1. Import the necessary classes:

```typescript
import {
  SoapMongo,
  MongoSource,
  MongoConfig,
  MongoTransformers
} from '@soapjs/soap-node-mongo';
import { Where, MetaMapper, DatabaseContext, ReadRepository, ReadWriteRepository, Entity } from '@soapjs/soap';
import { ObjectId } from 'mongodb';
```

### 2. Set up your MongoDB configuration:

```typescript
const config = new MongoConfig({
  host: 'localhost',
  port: 27017,
  database: 'myapp',
  username: 'user',
  password: 'password',
  authSource: 'admin',
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
});
```

### 3. Create a new `SoapMongo` driver instance:

```typescript
const soapMongo = await SoapMongo.create(config);
```

### 4. Define your entities and models:

```typescript
// Entity
interface User extends Entity {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  tags: string[];
  metadata: Record<string, any>;
}

// Approach 1: Model with decorators (recommended)
class UserModel {
  @EntityProperty("id", {
    transformer: MongoTransformers.objectId
  })
  _id: ObjectId;

  @EntityProperty("name", {
    transformer: MongoTransformers.trim
  })
  name: string;

  @EntityProperty("email", {
    transformer: MongoTransformers.lowercase
  })
  email: string;

  @EntityProperty("createdAt", {
    transformer: MongoTransformers.date
  })
  created_at: string;

  @EntityProperty("tags", {
    transformer: MongoTransformers.arrayToString
  })
  tags_csv: string;

  @EntityProperty("metadata", {
    transformer: MongoTransformers.objectToJson
  })
  metadata_json: string;
}

// Approach 2: Model without decorators (for manual mappings)
interface UserModelWithoutDecorators {
  _id: ObjectId;
  name: string;
  email: string;
  created_at: string;
  tags_csv: string;
  metadata_json: string;
}
```

### 5. Create MongoDB source and use with SOAPJS repositories:

#### Approach 1: Using Decorators (Recommended)

When you can use decorators in your models, this is the recommended approach as it provides better type safety and cleaner code.

```typescript
// Create mapper with model class (uses decorators)
const userMapper = new MetaMapper(User, UserModel);

// Create source with modelClass (not modelFieldMappings)
const userSource = new MongoSource<UserModel>(
  soapMongo,
  'users',
  {
    indexes: [
      { key: { email: 1 }, unique: true, name: 'email_unique_index' },
      { key: { created_at: -1 }, name: 'created_at_index' }
    ],
    modelClass: UserModel // Use modelClass when using decorators
  }
);

// Create data context
const userContext = new DatabaseContext(
  userSource,
  userMapper,
  soapMongo.sessions
);

// Create repositories using SOAPJS abstractions
const userReadRepo = new ReadRepository(userContext);
const userRepo = new ReadWriteRepository(userContext);
```

#### Approach 2: Using Manual Field Mappings

Use this approach when you can't use decorators (e.g., in environments where decorators are not supported) or when you prefer explicit field mappings.

```typescript
// Create mapper without model class
const userMapper = new MetaMapper(User);

// Create source with modelFieldMappings (not modelClass)
const userSource = new MongoSource<UserModel>(
  soapMongo,
  'users',
  {
    indexes: [
      { key: { email: 1 }, unique: true, name: 'email_unique_index' },
      { key: { created_at: -1 }, name: 'created_at_index' }
    ],
    modelFieldMappings: {
      id: { 
        name: '_id', 
        type: 'String',
        transformer: MongoTransformers.objectId
      },
      createdAt: { 
        name: 'created_at', 
        type: 'Date',
        transformer: MongoTransformers.date
      },
      tags: {
        name: 'tags_csv',
        type: 'Array',
        transformer: MongoTransformers.arrayToString
      },
      metadata: {
        name: 'metadata_json',
        type: 'Object',
        transformer: MongoTransformers.objectToJson
      }
    }
  }
);

// Create data context
const userContext = new DatabaseContext(
  userSource,
  userMapper,
  soapMongo.sessions
);

// Create repositories using SOAPJS abstractions
const userReadRepo = new ReadRepository(userContext);
const userRepo = new ReadWriteRepository(userContext);
```

#### When to Use Each Approach

**Use Decorators (Approach 1) when:**
- You can use TypeScript decorators in your project
- You want better type safety and IntelliSense support
- You prefer declarative approach with `@EntityProperty` decorators
- You want cleaner, more maintainable code
- You're working in a modern TypeScript environment
- You want automatic field mapping based on decorators

**Use Manual Field Mappings (Approach 2) when:**
- Decorators are not supported in your environment
- You need more control over field mappings
- You're working with existing models that can't be modified
- You prefer explicit configuration over decorators
- You're in a JavaScript-only environment
- You need dynamic field mappings based on runtime conditions
- You want to avoid decorator dependencies

#### Key Differences

| Aspect | Decorators (Approach 1) | Manual Mappings (Approach 2) |
|--------|-------------------------|------------------------------|
| **Type Safety** | High - TypeScript decorators provide compile-time checking | Medium - Manual configuration requires careful attention |
| **Code Cleanliness** | Clean - Declarative approach with decorators | More verbose - Explicit configuration required |
| **Flexibility** | Limited - Fixed at compile time | High - Can be changed at runtime |
| **Maintenance** | Easy - Changes in one place (decorators) | More complex - Changes in multiple places |
| **Performance** | Better - Decorators are processed at compile time | Good - Mappings are processed at runtime |
| **Environment Support** | Requires TypeScript with decorator support | Works in any JavaScript/TypeScript environment |

#### Migration Between Approaches

If you need to migrate from one approach to another:

**From Decorators to Manual Mappings:**
```typescript
// Before (with decorators)
class UserModel {
  @EntityProperty("id", { transformer: MongoTransformers.objectId })
  _id: ObjectId;
}

// After (with manual mappings)
const userSource = new MongoSource(soapMongo, 'users', {
  modelFieldMappings: {
    id: { name: '_id', type: 'String', transformer: MongoTransformers.objectId }
  }
});
```

**From Manual Mappings to Decorators:**
```typescript
// Before (with manual mappings)
const userSource = new MongoSource(soapMongo, 'users', {
  modelFieldMappings: {
    id: { name: '_id', type: 'String', transformer: MongoTransformers.objectId }
  }
});

// After (with decorators)
class UserModel {
  @EntityProperty("id", { transformer: MongoTransformers.objectId })
  _id: ObjectId;
}

const userSource = new MongoSource(soapMongo, 'users', {
  modelClass: UserModel
});
```

#### Complete Example with Both Approaches

```typescript
// Approach 1: With Decorators
class UserModelWithDecorators {
  @EntityProperty("id", {
    transformer: MongoTransformers.objectId
  })
  _id: ObjectId;

  @EntityProperty("name", {
    transformer: MongoTransformers.trim
  })
  name: string;

  @EntityProperty("email", {
    transformer: MongoTransformers.lowercase
  })
  email: string;

  @EntityProperty("createdAt", {
    transformer: MongoTransformers.date
  })
  created_at: string;

  @EntityProperty("tags", {
    transformer: MongoTransformers.arrayToString
  })
  tags_csv: string;

  @EntityProperty("metadata", {
    transformer: MongoTransformers.objectToJson
  })
  metadata_json: string;
}

// Using decorators approach
const userSourceWithDecorators = new MongoSource<UserModelWithDecorators>(
  soapMongo,
  'users',
  {
    indexes: [
      { key: { email: 1 }, unique: true }
    ],
    modelClass: UserModelWithDecorators // Use modelClass for decorators
  }
);

// Approach 2: With Manual Mappings
interface UserModelWithoutDecorators {
  _id: ObjectId;
  name: string;
  email: string;
  created_at: string;
  tags_csv: string;
  metadata_json: string;
}

// Using manual mappings approach
const userSourceWithMappings = new MongoSource<UserModelWithoutDecorators>(
  soapMongo,
  'users',
  {
    indexes: [
      { key: { email: 1 }, unique: true }
    ],
    modelFieldMappings: {
      id: { 
        name: '_id', 
        type: 'String',
        transformer: MongoTransformers.objectId
      },
      name: { 
        name: 'name', 
        type: 'String',
        transformer: MongoTransformers.trim
      },
      email: { 
        name: 'email', 
        type: 'String',
        transformer: MongoTransformers.lowercase
      },
      createdAt: { 
        name: 'created_at', 
        type: 'Date',
        transformer: MongoTransformers.date
      },
      tags: {
        name: 'tags_csv',
        type: 'Array',
        transformer: MongoTransformers.arrayToString
      },
      metadata: {
        name: 'metadata_json',
        type: 'Object',
        transformer: MongoTransformers.objectToJson
      }
    }
  }
);
```

### 6. Using repositories with SOAPJS abstractions:

#### Basic CRUD Operations

```typescript
// Find users with Where conditions
const where = new Where()
  .valueOf('status').isEq('active')
  .and.valueOf('age').isGte(18);

const result = await userRepo.find({ where });
if (result.isSuccess()) {
  const users = result.value;
  console.log('Found users:', users);
}

// Count users
const countResult = await userRepo.count({ where });
if (countResult.isSuccess()) {
  console.log('User count:', countResult.value);
}

// Add new user
const newUser: User = {
  id: '507f1f77bcf86cd799439011', // Will be transformed to ObjectId
  name: 'John Doe',
  email: 'JOHN@EXAMPLE.COM', // Will be transformed to lowercase
  createdAt: new Date(), // Will be transformed to ISO string
  tags: ['admin', 'user'], // Will be transformed to comma-separated string
  metadata: { role: 'admin', permissions: ['read', 'write'] } // Will be transformed to JSON string
};

const addResult = await userRepo.add([newUser]);
if (addResult.isSuccess()) {
  console.log('User added:', addResult.value);
}

// Update user
const updateResult = await userRepo.update({
  where: new Where().valueOf('id').isEq('507f1f77bcf86cd799439011'),
  updates: [{ name: 'Jane Doe' }],
  methods: ['updateOne']
});
if (updateResult.isSuccess()) {
  console.log('User updated:', updateResult.value);
}

// Remove user
const removeResult = await userRepo.remove({
  where: new Where().valueOf('id').isEq('507f1f77bcf86cd799439011')
});
if (removeResult.isSuccess()) {
  console.log('User removed:', removeResult.value);
}
```

#### Advanced Queries

```typescript
// Complex Where conditions
const complexWhere = new Where()
  .valueOf('status').isEq('active')
  .and.brackets(w => {
    w.valueOf('age').isGte(18)
      .and.valueOf('age').isLte(65);
  })
  .and.brackets(w => {
    w.valueOf('role').isEq('admin')
      .or.valueOf('role').isEq('moderator');
  });

const users = await userRepo.find({ 
  where: complexWhere,
  limit: 10,
  offset: 0,
  sort: { createdAt: 'desc' }
});

// Aggregation queries
const aggregationResult = await userRepo.aggregate({
  where: new Where().valueOf('status').isEq('active'),
  groupBy: ['role'],
  having: { count: { $gte: 5 } }
});
```

### 7. Transaction Support

#### Using SOAPJS Transaction System

```typescript
import { Transaction, TransactionRunner, Result } from '@soapjs/soap';

class CreateUserTransaction extends Transaction<void> {
  constructor(
    private readonly userRepo: ReadWriteRepository<User>,
    private readonly userData: { name: string; email: string }
  ) {
    super(userRepo);
  }

  public async execute(): Promise<Result<void>> {
    const user: User = {
      id: '507f1f77bcf86cd799439011',
      name: this.userData.name,
      email: this.userData.email,
      createdAt: new Date(),
      tags: [],
      metadata: {}
    };
    
    const result = await this.userRepo.add([user]);
    
    if (result.isFailure()) {
      this.abort("Failed to create user: " + result.failure.error.message);
    }

    return Result.withSuccess();
  }
}

// Execute transaction
const runner = TransactionRunner.getInstance('default');
const transaction = new CreateUserTransaction(userRepo, {
  name: 'John Doe',
  email: 'john@example.com'
});

const result = await runner.run(transaction);
if (result.isSuccess()) {
  console.log('Transaction completed successfully');
} else {
  console.error('Transaction failed:', result.failure.error.message);
}
```

#### Using Decorators

```typescript
import { IsTransaction, UseSession, Injectable } from '@soapjs/soap';

@IsTransaction({ tag: 'default' })
@Injectable()
class UserService {
  @UseSession()
  @Inject('UserRepository')
  private userRepo: ReadWriteRepository<User>;

  public async createUser(userData: { name: string; email: string }): Promise<Result<void>> {
    const user: User = {
      id: '507f1f77bcf86cd799439011',
      name: userData.name,
      email: userData.email,
      createdAt: new Date(),
      tags: [],
      metadata: {}
    };
    
    const result = await this.userRepo.add([user]);
    
    if (result.isFailure()) {
      this.abort("Failed to create user");
    }

    return Result.withSuccess();
  }
}
```

### 8. Using Common Transformers

```typescript
// Available transformers
const transformers = {
  // ObjectId transformations
  objectId: MongoTransformers.objectId, // string <-> ObjectId
  
  // Date transformations
  date: MongoTransformers.date, // Date <-> ISO string
  timestamp: MongoTransformers.timestamp, // Date <-> timestamp number
  
  // Array transformations
  arrayToString: MongoTransformers.arrayToString, // array <-> comma-separated string
  objectIdArray: MongoTransformers.objectIdArray, // string[] <-> ObjectId[]
  
  // Object transformations
  objectToJson: MongoTransformers.objectToJson, // object <-> JSON string
  
  // String transformations
  lowercase: MongoTransformers.lowercase, // string -> lowercase
  uppercase: MongoTransformers.uppercase, // string -> uppercase
  trim: MongoTransformers.trim, // string -> trimmed
  
  // Number transformations
  cents: MongoTransformers.cents, // number <-> cents (multiplied by 100)
  
  // Boolean transformations
  booleanToNumber: MongoTransformers.booleanToNumber // boolean <-> number (0/1)
};

// Example usage in model
class ProductModel {
  @EntityProperty("id", {
    transformer: MongoTransformers.objectId
  })
  _id: ObjectId;

  @EntityProperty("name", {
    transformer: MongoTransformers.trim
  })
  name: string;

  @EntityProperty("price", {
    transformer: MongoTransformers.cents
  })
  price_cents: number;

  @EntityProperty("categories", {
    transformer: MongoTransformers.arrayToString
  })
  categories_csv: string;

  @EntityProperty("isActive", {
    transformer: MongoTransformers.booleanToNumber
  })
  active: number;

  @EntityProperty("createdAt", {
    transformer: MongoTransformers.timestamp
  })
  created_at: number;
}
```

## Advanced Usage

### Custom Query Builders

```typescript
import { QueryBuilder } from '@soapjs/soap';

class UserQueryBuilder extends QueryBuilder {
  static activeUsers(limit?: number) {
    return new UserQueryBuilder()
      .with({ 
        where: new Where().valueOf('status').isEq('active'),
        ...(limit && { limit })
      });
  }

  static byDepartment(department: string, limit?: number) {
    return new UserQueryBuilder()
      .with({ 
        where: new Where().valueOf('department').isEq(department),
        ...(limit && { limit })
      });
  }
}

// Usage
const activeUsers = await userRepo.find(UserQueryBuilder.activeUsers(10));
const itUsers = await userRepo.find(UserQueryBuilder.byDepartment('IT', 20));
```

### Error Handling

```typescript
const result = await userRepo.find({ where: new Where().valueOf('email').isEq('john@example.com') });

if (result.isSuccess()) {
  const users = result.value;
  // Process users
} else {
  const { error } = result.failure;
  console.error('Failed to find users:', error.message);
  
  // Handle specific error types
  if (error instanceof CollectionError) {
    // Handle collection errors
  }
}
```

### Testing

```typescript
describe('UserRepository', () => {
  let userRepo: ReadWriteRepository<User>;
  let mockSource: MongoSource<UserModel>;

  beforeEach(() => {
    // Create mock source
    mockSource = {
      collectionName: 'users',
      find: jest.fn().mockResolvedValue([mockUserModel]),
      count: jest.fn().mockResolvedValue(1),
      aggregate: jest.fn(),
      update: jest.fn(),
      insert: jest.fn(),
      remove: jest.fn()
    } as any;

    // Create test context
    const testContext = new DatabaseContext(mockSource, mockMapper, mockSessionManager);
    userRepo = new ReadWriteRepository(testContext);
  });

  it('should find users', async () => {
    const result = await userRepo.find();
    expect(result.isSuccess()).toBe(true);
    expect(result.value).toHaveLength(1);
  });
});
```

## Performance Monitoring

The package includes **optional** built-in performance monitoring capabilities to help you track and optimize your MongoDB operations. Performance monitoring is **disabled by default** and can be enabled when needed.

### Basic Usage

```typescript
import { 
  SoapMongo, 
  MongoSource, 
  MongoConfig,
  MongoPerformanceMonitorImpl 
} from '@soapjs/soap-node-mongo';

// Create MongoDB source WITHOUT performance monitoring (default)
const userSource = new MongoSource<UserModel>(
  soapMongo,
  'users',
  {
    indexes: [
      { key: { email: 1 }, unique: true, name: 'email_unique_index' }
    ]
    // No performanceMonitoring config - monitoring is disabled
  }
);

// Create MongoDB source WITH performance monitoring
const monitoredUserSource = new MongoSource<UserModel>(
  soapMongo,
  'users',
  {
    indexes: [
      { key: { email: 1 }, unique: true, name: 'email_unique_index' }
    ],
    performanceMonitoring: {
      enabled: true, // Enable performance monitoring
      detailed: true,
      slowQueryThreshold: 1000, // 1 second
      maxMetrics: 1000,
      metricsCollector: (metrics) => {
        // Custom metrics collector (e.g., send to monitoring service)
        console.log('Performance metric:', metrics);
      }
    }
  }
);

// Use the source normally - performance is automatically monitored when enabled
const users = await monitoredUserSource.find();
const count = await monitoredUserSource.count();

// Get performance metrics (only available when monitoring is enabled)
const metrics = monitoredUserSource.getPerformanceMetrics();
const summary = monitoredUserSource.getPerformanceSummary();
const slowQueries = monitoredUserSource.getSlowQueries();

console.log('Performance Summary:', summary);
console.log('Slow Queries:', slowQueries);
```

### Performance Metrics

Each operation generates detailed metrics including:

- **Operation type** (find, insert, update, delete, aggregate)
- **Collection name**
- **Duration** in milliseconds
- **Document count** affected
- **Query complexity** (simple, complex, aggregation)
- **Success/failure status**
- **Error messages** (if any)
- **Timestamp**
- **Additional metadata**

### Performance Summary

The performance summary provides aggregated statistics:

```typescript
interface MongoPerformanceSummary {
  totalOperations: number;
  averageDuration: number;
  slowOperations: number;
  errorRate: number;
  operationsByType: Record<string, number>;
  averageDurationByType: Record<string, number>;
}
```

### Custom Metrics Collector

You can implement custom metrics collectors to send data to monitoring services:

```typescript
const userSource = new MongoSource<UserModel>(
  soapMongo,
  'users',
  {
    performanceMonitoring: {
      enabled: true,
      metricsCollector: (metrics) => {
        // Send to Prometheus, DataDog, New Relic, etc.
        if (metrics.duration > 1000) {
          // Alert on slow queries
          alertService.sendAlert(`Slow query detected: ${metrics.operation} took ${metrics.duration}ms`);
        }
        
        // Send to monitoring service
        monitoringService.recordMetric('mongodb.operation.duration', metrics.duration, {
          operation: metrics.operation,
          collection: metrics.collection,
          success: metrics.success
        });
      }
    }
  }
);
```

### Standalone Performance Monitor

You can also use the performance monitor independently:

```typescript
import { MongoPerformanceMonitorImpl } from '@soapjs/soap-node-mongo';

const monitor = new MongoPerformanceMonitorImpl({
  enabled: true,
  slowQueryThreshold: 500,
  maxMetrics: 5000
});

// Start monitoring an operation
const operationId = monitor.startOperation('custom', 'users', {
  userId: '123',
  action: 'profile_update'
});

try {
  // Perform your operation
  await someDatabaseOperation();
  
  // End monitoring with success
  monitor.endOperation(operationId, 1);
} catch (error) {
  // End monitoring with error
  monitor.endOperation(operationId, undefined, error);
}

// Get metrics
const metrics = monitor.getMetrics();
const summary = monitor.getSummary();
```

## Advanced Configuration

### Connection Pool Configuration

The package supports advanced connection pool configuration for optimal performance in production environments.

```typescript
import { 
  SoapMongo, 
  MongoConfig,
  MongoConnectionPoolConfig 
} from '@soapjs/soap-node-mongo';

// Advanced connection pool configuration
const connectionPoolConfig: MongoConnectionPoolConfig = {
  maxPoolSize: 50,                    // Maximum connections in pool
  minPoolSize: 5,                     // Minimum connections in pool
  maxConnecting: 2,                   // Max connections created per second
  maxIdleTimeMS: 30000,               // Max time connection can be idle
  waitQueueTimeoutMS: 30000,          // Max time to wait for connection
  connectTimeoutMS: 30000,            // Connection timeout
  socketTimeoutMS: 30000,             // Socket timeout
  serverSelectionTimeoutMS: 30000,    // Server selection timeout
  heartbeatFrequencyMS: 10000,        // Heartbeat frequency
  retryWrites: true,                  // Retry writes on failure
  retryReads: true                    // Retry reads on failure
};

const config = new MongoConfig(
  'myapp',
  ['localhost'],
  [27017],
  'user',
  'password',
  'DEFAULT',
  'admin',
  false,
  undefined,
  false,
  connectionPoolConfig
);

const soapMongo = await SoapMongo.create(config);

// Get connection pool statistics
const poolStats = await soapMongo.getConnectionPoolStats();
console.log('Connection pool stats:', poolStats);

// Get server status
const serverStatus = await soapMongo.getServerStatus();
console.log('Server status:', serverStatus);
```

### Database Migrations

The package includes a powerful migration system for managing database schema changes.

#### Creating Migrations

```typescript
import { 
  BaseMigration, 
  MongoMigrationManager,
  SoapMongo 
} from '@soapjs/soap-node-mongo';
import * as mongoDb from 'mongodb';

// Create a migration
class CreateUsersCollection extends BaseMigration {
  id = 'create-users-collection';
  version = 1;
  description = 'Create users collection with indexes';
  reversible = true;

  async up(database: mongoDb.Db): Promise<void> {
    // Create collection
    await database.createCollection('users');
    
    // Create indexes
    const collection = database.collection('users');
    await collection.createIndex({ email: 1 }, { unique: true });
    await collection.createIndex({ createdAt: 1 });
  }

  async down(database: mongoDb.Db): Promise<void> {
    // Drop collection
    await database.dropCollection('users');
  }
}

class AddUserStatusField extends BaseMigration {
  id = 'add-user-status-field';
  version = 2;
  description = 'Add status field to users collection';
  reversible = true;

  async up(database: mongoDb.Db): Promise<void> {
    const collection = database.collection('users');
    await collection.updateMany(
      { status: { $exists: false } },
      { $set: { status: 'active' } }
    );
  }

  async down(database: mongoDb.Db): Promise<void> {
    const collection = database.collection('users');
    await collection.updateMany(
      {},
      { $unset: { status: '' } }
    );
  }
}
```

#### Running Migrations

```typescript
// Initialize migration manager
const migrationManager = new MongoMigrationManager(soapMongo, {
  collectionName: 'migrations',
  autoRun: false,
  validateBeforeRun: true,
  maxBatchSize: 10
});

// Register migrations
migrationManager.register(new CreateUsersCollection());
migrationManager.register(new AddUserStatusField());

// Run migrations
const result = await migrationManager.migrate();
console.log('Migration result:', result);

// Check migration status
const status = await migrationManager.getMigrationStatus();
console.log('Migration status:', status);

// Rollback last migration
const rollbackResult = await migrationManager.rollback();
console.log('Rollback result:', rollbackResult);

// Rollback to specific version
const rollbackToResult = await migrationManager.rollbackTo(1);
console.log('Rollback to version 1:', rollbackToResult);
```

#### Migration Status

```typescript
// Check if specific migration is applied
const isApplied = await migrationManager.isMigrationApplied('create-users-collection');
console.log('Is migration applied:', isApplied);

// Get all registered migrations
const migrations = migrationManager.getMigrations();
console.log('Registered migrations:', migrations);
```

## API Reference

### Core Classes

- **SoapMongo**: Main MongoDB driver class for managing connections and sessions
- **MongoSource**: MongoDB data source implementation implementing Source interface
- **MongoQueryFactory**: MongoDB query factory for building complex queries
- **MongoWhereParser**: Parser for converting Where conditions to MongoDB filters
- **MongoFieldResolver**: Field mapping and transformation between entities and documents
- **MongoDatabaseSession**: MongoDB session implementation for transactions
- **MongoSessionManager**: Session management for MongoDB connections
- **MongoTransformers**: Common transformers for MongoDB data patterns
- **MongoPerformanceMonitorImpl**: Performance monitoring implementation
- **MongoMigrationManager**: Migration system for database schema changes

### Configuration Classes

- **MongoConfig**: MongoDB configuration with connection pool settings
- **MongoConnectionPoolConfig**: Advanced connection pool configuration
- **CollectionOptions**: Options for MongoDB collections including performance monitoring
- **MigrationConfig**: Configuration for database migrations

### Interfaces

- **MongoMigration**: Interface for database migrations
- **MigrationStatus**: Status information for migrations
- **MigrationResult**: Result of migration operations
- **MongoPerformanceMetrics**: Performance metrics for operations
- **MongoPerformanceSummary**: Summary statistics for performance monitoring

### Utility Classes

- **MongoUtils**: Utility functions for MongoDB operations
- **BaseMigration**: Base class for creating migrations
- **BlankPerformanceMonitor**: No-op performance monitor for when monitoring is disabled

## Error Handling

The package provides comprehensive error handling with specific MongoDB error types:

```typescript
import { CollectionError, BulkUpdateOperationsError } from '@soapjs/soap-node-mongo';

try {
  const result = await userRepo.add([user]);
  if (result.isSuccess()) {
    console.log('User added successfully');
  } else {
    const error = result.failure.error;
    
    if (error instanceof CollectionError) {
      switch (error.type) {
        case 'DUPLICATE':
          console.error('Duplicate key error:', error.message);
          break;
        case 'VALIDATION':
          console.error('Validation error:', error.message);
          break;
        case 'CONNECTION':
          console.error('Connection error:', error.message);
          break;
        default:
          console.error('Collection error:', error.message);
      }
    }
  }
} catch (error) {
  console.error('Unexpected error:', error);
}
```

## Testing

### Unit Tests

Run unit tests (mocked MongoDB):

```bash
npm run test:unit
```

### Integration Tests

Integration tests use **Testcontainers** to automatically start and manage MongoDB containers for testing.

#### Prerequisites

1. **Docker**: Ensure Docker is running on your system
2. **Testcontainers**: Automatically manages MongoDB containers
3. **No manual setup required**: Everything is handled automatically

#### Running Integration Tests

```bash
# Run only integration tests (requires Docker)
npm run test:integration

# Run all tests (unit + integration)
npm test
```

#### Integration Test Coverage

Integration tests cover:

- **MongoSource Operations**: CRUD, queries, aggregations, transactions
- **Performance Monitoring**: Metrics collection, slow query detection
- **Migration System**: Migration execution, rollback, status tracking
- **Error Handling**: Duplicate keys, validation errors
- **Real-world Scenarios**: Bulk operations, concurrent access, large datasets

#### Test Environment

Integration tests use:

- **Isolated Containers**: Each test run gets a fresh MongoDB container
- **Automatic Management**: Containers are started/stopped automatically
- **Real MongoDB**: Actual database operations (no mocking)
- **Timeout Handling**: 30-second timeout for slow operations
- **Clean State**: Collections cleaned before each test

#### Continuous Integration

For CI/CD pipelines (Testcontainers work out of the box):

```yaml
# Example GitHub Actions workflow
- name: Run Integration Tests
  run: |
    npm run test:integration
  env:
    # Testcontainers automatically handles Docker setup
```

#### Troubleshooting Integration Tests

**Common Issues:**

1. **Docker Not Running**
   ```bash
   # Check if Docker is running
   docker ps
   
   # Start Docker if needed
   # (Platform specific)
   ```

2. **Testcontainers Issues**
   ```bash
   # Check Docker permissions
   docker run hello-world
   
   # Verify testcontainers can pull images
   docker pull mongo:6.3
   ```

3. **Timeout Issues**
   ```bash
   # Increase timeout in jest.config.integration.json
   "testTimeout": 60000
   ```

4. **Container Cleanup**
   ```bash
   # Manual cleanup if needed
   docker ps -a | grep testcontainers | awk '{print $1}' | xargs docker rm -f
   ```

### Debug Mode

```typescript
// Enable debug logging
const source = new MongoSource(soapMongo, 'users', {
  performanceMonitoring: {
    enabled: true,
    detailed: true,
    metricsCollector: (metrics) => {
      console.log('Operation:', metrics.operation, 'Duration:', metrics.duration, 'ms');
    }
  }
});
```

## Performance Optimization

### Indexing Strategy

```typescript
// Create indexes for optimal performance
const userSource = new MongoSource(soapMongo, 'users', {
  indexes: [
    // Primary index on email (unique)
    { key: { email: 1 }, unique: true, name: 'email_unique_index' },
    
    // Compound index for queries
    { key: { status: 1, createdAt: -1 }, name: 'status_created_at_index' },
    
    // Text index for search
    { key: { name: 'text', description: 'text' }, name: 'text_search_index' },
    
    // Geospatial index
    { key: { location: '2dsphere' }, name: 'location_index' }
  ]
});
```

### Query Optimization

```typescript
// Use projection to limit returned fields
const users = await userRepo.find({
  projection: { name: 1, email: 1, _id: 0 }
});

// Use limit and skip for pagination
const paginatedUsers = await userRepo.find({
  limit: 10,
  offset: 20
});

// Use sort for ordered results
const sortedUsers = await userRepo.find({
  sort: { createdAt: -1 }
});
```

### Connection Pool Optimization

```typescript
const connectionPoolConfig: MongoConnectionPoolConfig = {
  maxPoolSize: 50,           // Adjust based on your application needs
  minPoolSize: 5,            // Keep minimum connections ready
  maxConnecting: 2,          // Limit concurrent connections
  maxIdleTimeMS: 30000,      // Close idle connections after 30s
  waitQueueTimeoutMS: 30000, // Wait up to 30s for available connection
  connectTimeoutMS: 30000,   // Connection timeout
  socketTimeoutMS: 30000,    // Socket timeout
  serverSelectionTimeoutMS: 30000, // Server selection timeout
  heartbeatFrequencyMS: 10000,     // Heartbeat frequency
  retryWrites: true,         // Retry failed writes
  retryReads: true           // Retry failed reads
};
```

## Security Best Practices

### Authentication and Authorization

```typescript
// Use environment variables for sensitive data
const config = new MongoConfig(
  process.env.MONGO_DB_NAME || 'myapp',
  process.env.MONGO_HOSTS?.split(',') || ['localhost'],
  process.env.MONGO_PORTS?.split(',').map(Number) || [27017],
  process.env.MONGO_USER,
  process.env.MONGO_PASSWORD,
  process.env.MONGO_AUTH_MECHANISM || 'DEFAULT',
  process.env.MONGO_AUTH_SOURCE || 'admin',
  process.env.MONGO_SSL === 'true',
  process.env.MONGO_REPLICA_SET,
  process.env.MONGO_SRV === 'true'
);
```

### Data Validation

```typescript
// Use field transformers for data validation
class UserModel {
  @EntityProperty("email", {
    transformer: MongoTransformers.lowercase,
    validator: (value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        throw new Error('Invalid email format');
      }
      return value;
    }
  })
  email: string;
}
```

## Troubleshooting

### Common Issues

1. **Connection Issues**
   ```typescript
   // Check connection status
   const poolStats = await soapMongo.getConnectionPoolStats();
   console.log('Connection pool stats:', poolStats);
   ```

2. **Performance Issues**
   ```typescript
   // Enable performance monitoring
   const source = new MongoSource(soapMongo, 'users', {
     performanceMonitoring: {
       enabled: true,
       slowQueryThreshold: 1000
     }
   });
   
   // Check slow queries
   const slowQueries = source.getSlowQueries();
   console.log('Slow queries:', slowQueries);
   ```

3. **Migration Issues**
   ```typescript
   // Check migration status
   const status = await migrationManager.getMigrationStatus();
   console.log('Migration status:', status);
   
   // Rollback if needed
   const rollbackResult = await migrationManager.rollback();
   console.log('Rollback result:', rollbackResult);
   ```

### Debug Mode

```typescript
// Enable debug logging
const source = new MongoSource(soapMongo, 'users', {
  performanceMonitoring: {
    enabled: true,
    detailed: true,
    metricsCollector: (metrics) => {
      console.log('Operation:', metrics.operation, 'Duration:', metrics.duration, 'ms');
    }
  }
});
```

## Migration Guide

### From Previous Versions

#### Version 0.2.x to 0.3.x

1. **Performance Monitoring**: New optional feature - no breaking changes
2. **Connection Pool**: Enhanced configuration - backward compatible
3. **Migrations**: New feature - no impact on existing code

#### Breaking Changes

- None in version 0.3.x

## Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**:
   - Follow TypeScript best practices
   - Add comprehensive tests
   - Update documentation
   - Ensure all tests pass
4. **Commit your changes**: `git commit -m 'Add amazing feature'`
5. **Push to the branch**: `git push origin feature/amazing-feature`
6. **Submit a pull request**

### Development Setup

```bash
# Clone the repository
git clone https://github.com/soapjs/soap-node-mongo.git
cd soap-node-mongo

# Install dependencies
npm install

# Run tests
npm run test:unit

# Build the project
npm run build

# Check code coverage
npm run test:unit -- --coverage
```

### Code Style

- Use TypeScript for all new code
- Follow ESLint configuration
- Use Prettier for code formatting
- Write comprehensive JSDoc comments
- Follow conventional commit messages

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: [https://docs.soapjs.com](https://docs.soapjs.com)
- **Issues**: [GitHub Issues](https://github.com/soapjs/soap-node-mongo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/soapjs/soap-node-mongo/discussions)
- **Email**: radoslaw.kamysz@gmail.com

## Usage Examples

### E-commerce Application

```typescript
import { 
  SoapMongo, 
  MongoSource, 
  MongoConfig,
  MongoTransformers 
} from '@soapjs/soap-node-mongo';
import { Where, MetaMapper, DatabaseContext, ReadRepository, ReadWriteRepository } from '@soapjs/soap';
import { ObjectId } from 'mongodb';

// Product entity
interface Product extends Entity {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  tags: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Product model with decorators
class ProductModel {
  @EntityProperty("id", { transformer: MongoTransformers.objectId })
  _id: ObjectId;

  @EntityProperty("name", { transformer: MongoTransformers.trim })
  name: string;

  @EntityProperty("description", { transformer: MongoTransformers.trim })
  description: string;

  @EntityProperty("price", { transformer: MongoTransformers.cents })
  price_cents: number;

  @EntityProperty("category", { transformer: MongoTransformers.lowercase })
  category: string;

  @EntityProperty("tags", { transformer: MongoTransformers.arrayToString })
  tags_csv: string;

  @EntityProperty("isActive", { transformer: MongoTransformers.booleanToNumber })
  active: number;

  @EntityProperty("createdAt", { transformer: MongoTransformers.timestamp })
  created_at: number;

  @EntityProperty("updatedAt", { transformer: MongoTransformers.timestamp })
  updated_at: number;
}

// Setup
const config = new MongoConfig('ecommerce', ['localhost'], [27017]);
const soapMongo = await SoapMongo.create(config);

const productMapper = new MetaMapper(Product, ProductModel);
const productSource = new MongoSource(soapMongo, 'products', {
  indexes: [
    { key: { name: 1 }, name: 'name_index' },
    { key: { category: 1, active: 1 }, name: 'category_active_index' },
    { key: { price_cents: 1 }, name: 'price_index' },
    { key: { tags_csv: 1 }, name: 'tags_index' }
  ],
  modelClass: ProductModel,
  performanceMonitoring: {
    enabled: true,
    slowQueryThreshold: 500
  }
});

const productContext = new DatabaseContext(productSource, productMapper, soapMongo.sessions);
const productRepo = new ReadWriteRepository(productContext);

// Usage examples
async function productExamples() {
  // Create product
  const newProduct: Product = {
    id: '507f1f77bcf86cd799439011',
    name: 'Wireless Headphones',
    description: 'High-quality wireless headphones',
    price: 99.99,
    category: 'Electronics',
    tags: ['wireless', 'audio', 'bluetooth'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const createResult = await productRepo.add([newProduct]);
  if (createResult.isSuccess()) {
    console.log('Product created:', createResult.value);
  }

  // Find active products in Electronics category
  const where = new Where()
    .valueOf('category').isEq('electronics')
    .and.valueOf('isActive').isEq(true);

  const products = await productRepo.find({ where, limit: 10 });
  if (products.isSuccess()) {
    console.log('Found products:', products.value);
  }

  // Update product price
  const updateResult = await productRepo.update({
    where: new Where().valueOf('id').isEq('507f1f77bcf86cd799439011'),
    updates: [{ price: 89.99 }],
    methods: ['updateOne']
  });

  // Search products by tags
  const tagSearch = await productRepo.find({
    where: new Where().valueOf('tags').isLike('wireless'),
    sort: { price: 'asc' }
  });
}
```

### User Management System

```typescript
// User entity with complex relationships
interface User extends Entity {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'moderator';
  status: 'active' | 'inactive' | 'suspended';
  profile: {
    avatar?: string;
    bio?: string;
    location?: string;
  };
  preferences: {
    theme: 'light' | 'dark';
    notifications: boolean;
    language: string;
  };
  createdAt: Date;
  lastLoginAt?: Date;
}

class UserModel {
  @EntityProperty("id", { transformer: MongoTransformers.objectId })
  _id: ObjectId;

  @EntityProperty("email", { transformer: MongoTransformers.lowercase })
  email: string;

  @EntityProperty("name", { transformer: MongoTransformers.trim })
  name: string;

  @EntityProperty("role", { transformer: MongoTransformers.lowercase })
  role: string;

  @EntityProperty("status", { transformer: MongoTransformers.lowercase })
  status: string;

  @EntityProperty("profile", { transformer: MongoTransformers.objectToJson })
  profile_json: string;

  @EntityProperty("preferences", { transformer: MongoTransformers.objectToJson })
  preferences_json: string;

  @EntityProperty("createdAt", { transformer: MongoTransformers.timestamp })
  created_at: number;

  @EntityProperty("lastLoginAt", { transformer: MongoTransformers.timestamp })
  last_login_at?: number;
}

// User service with transactions
class UserService {
  constructor(private userRepo: ReadWriteRepository<User>) {}

  @IsTransaction({ tag: 'default' })
  async createUser(userData: Omit<User, 'id' | 'createdAt'>): Promise<Result<User>> {
    const user: User = {
      id: new ObjectId().toString(),
      ...userData,
      createdAt: new Date()
    };

    const result = await this.userRepo.add([user]);
    if (result.isFailure()) {
      this.abort('Failed to create user');
    }

    return Result.withSuccess(user);
  }

  @IsTransaction({ tag: 'default' })
  async updateUserStatus(userId: string, status: User['status']): Promise<Result<void>> {
    const result = await this.userRepo.update({
      where: new Where().valueOf('id').isEq(userId),
      updates: [{ status }],
      methods: ['updateOne']
    });

    if (result.isFailure()) {
      this.abort('Failed to update user status');
    }

    return Result.withSuccess();
  }

  async getActiveUsers(limit = 10): Promise<Result<User[]>> {
    const where = new Where().valueOf('status').isEq('active');
    return await this.userRepo.find({ where, limit });
  }

  async getUserByEmail(email: string): Promise<Result<User | null>> {
    const where = new Where().valueOf('email').isEq(email.toLowerCase());
    const result = await this.userRepo.find({ where, limit: 1 });
    
    if (result.isSuccess() && result.value.length > 0) {
      return Result.withSuccess(result.value[0]);
    }
    
    return Result.withSuccess(null);
  }
}
```

### Analytics Dashboard

```typescript
// Analytics data model
interface AnalyticsEvent extends Entity {
  id: string;
  userId?: string;
  eventType: 'page_view' | 'click' | 'purchase' | 'signup';
  page?: string;
  timestamp: Date;
  metadata: Record<string, any>;
  sessionId?: string;
}

class AnalyticsEventModel {
  @EntityProperty("id", { transformer: MongoTransformers.objectId })
  _id: ObjectId;

  @EntityProperty("userId", { transformer: MongoTransformers.objectId })
  user_id?: ObjectId;

  @EntityProperty("eventType", { transformer: MongoTransformers.lowercase })
  event_type: string;

  @EntityProperty("page", { transformer: MongoTransformers.trim })
  page?: string;

  @EntityProperty("timestamp", { transformer: MongoTransformers.timestamp })
  timestamp: number;

  @EntityProperty("metadata", { transformer: MongoTransformers.objectToJson })
  metadata_json: string;

  @EntityProperty("sessionId", { transformer: MongoTransformers.trim })
  session_id?: string;
}

// Analytics service with aggregations
class AnalyticsService {
  constructor(private analyticsRepo: ReadRepository<AnalyticsEvent>) {}

  async getEventCountsByType(dateRange: { start: Date; end: Date }): Promise<Result<any[]>> {
    const where = new Where()
      .valueOf('timestamp').isGte(dateRange.start.getTime())
      .and.valueOf('timestamp').isLte(dateRange.end.getTime());

    const result = await this.analyticsRepo.aggregate({
      where,
      groupBy: ['eventType'],
      having: { count: { $gte: 1 } }
    });

    return result;
  }

  async getPageViewsByPage(dateRange: { start: Date; end: Date }): Promise<Result<any[]>> {
    const where = new Where()
      .valueOf('eventType').isEq('page_view')
      .and.valueOf('timestamp').isGte(dateRange.start.getTime())
      .and.valueOf('timestamp').isLte(dateRange.end.getTime());

    const result = await this.analyticsRepo.aggregate({
      where,
      groupBy: ['page'],
      having: { count: { $gte: 1 } },
      sort: { count: 'desc' },
      limit: 10
    });

    return result;
  }

  async getUserJourney(userId: string): Promise<Result<AnalyticsEvent[]>> {
    const where = new Where().valueOf('userId').isEq(userId);
    
    const result = await this.analyticsRepo.find({
      where,
      sort: { timestamp: 'asc' },
      limit: 100
    });

    return result;
  }
}
```

### Real-time Chat Application

```typescript
// Message entity for chat
interface Message extends Entity {
  id: string;
  roomId: string;
  userId: string;
  content: string;
  type: 'text' | 'image' | 'file';
  metadata?: {
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  };
  createdAt: Date;
  updatedAt?: Date;
}

class MessageModel {
  @EntityProperty("id", { transformer: MongoTransformers.objectId })
  _id: ObjectId;

  @EntityProperty("roomId", { transformer: MongoTransformers.objectId })
  room_id: ObjectId;

  @EntityProperty("userId", { transformer: MongoTransformers.objectId })
  user_id: ObjectId;

  @EntityProperty("content", { transformer: MongoTransformers.trim })
  content: string;

  @EntityProperty("type", { transformer: MongoTransformers.lowercase })
  type: string;

  @EntityProperty("metadata", { transformer: MongoTransformers.objectToJson })
  metadata_json?: string;

  @EntityProperty("createdAt", { transformer: MongoTransformers.timestamp })
  created_at: number;

  @EntityProperty("updatedAt", { transformer: MongoTransformers.timestamp })
  updated_at?: number;
}

// Chat service with real-time features
class ChatService {
  constructor(private messageRepo: ReadWriteRepository<Message>) {}

  async sendMessage(messageData: Omit<Message, 'id' | 'createdAt'>): Promise<Result<Message>> {
    const message: Message = {
      id: new ObjectId().toString(),
      ...messageData,
      createdAt: new Date()
    };

    const result = await this.messageRepo.add([message]);
    if (result.isSuccess()) {
      return Result.withSuccess(message);
    }

    return Result.withFailure(result.failure);
  }

  async getRoomMessages(roomId: string, limit = 50, offset = 0): Promise<Result<Message[]>> {
    const where = new Where().valueOf('roomId').isEq(roomId);
    
    const result = await this.messageRepo.find({
      where,
      sort: { createdAt: 'desc' },
      limit,
      offset
    });

    return result;
  }

  async searchMessages(roomId: string, query: string): Promise<Result<Message[]>> {
    const where = new Where()
      .valueOf('roomId').isEq(roomId)
      .and.valueOf('content').isLike(query);

    const result = await this.messageRepo.find({
      where,
      sort: { createdAt: 'desc' },
      limit: 20
    });

    return result;
  }

  async getMessageStats(roomId: string): Promise<Result<any>> {
    const where = new Where().valueOf('roomId').isEq(roomId);
    
    const result = await this.messageRepo.aggregate({
      where,
      groupBy: ['type'],
      having: { count: { $gte: 1 } }
    });

    return result;
  }
}
```

## MongoDB Version Compatibility

### Version Strategy

This package uses a **version-locked approach** for MongoDB compatibility to ensure stability and reliability:

- **Current supported version**: `^6.3.0`
- **Minimum supported version**: `6.3.0`
- **Version updates**: Released as new package versions with proper testing

### Why Version Locking?

1. **Stability**: Prevents breaking changes from unexpected MongoDB updates
2. **Predictability**: Users know exactly which MongoDB version is supported
3. **Testing**: Each version is thoroughly tested before release
4. **Security**: Controlled updates with security patches

### Version Update Process

When a new MongoDB version is released:

1. **Testing**: Full test suite runs against new version
2. **Compatibility check**: Verify all features work correctly
3. **Documentation**: Update compatibility matrix
4. **Release**: New package version with updated peer dependency

### Migration Between MongoDB Versions

```bash
# Check current MongoDB version
npm list mongodb

# Update to new package version (when available)
npm install @soapjs/soap-node-mongo@latest

# Update MongoDB driver (if needed)
npm install mongodb@^6.3.0
```

### Compatibility Matrix

| Package Version | MongoDB Driver | Node.js | Status |
|----------------|----------------|---------|--------|
| 0.3.x | ^6.3.0 | >=16.0.0 | Current |
| 0.2.x | ^5.0.0 | >=14.0.0 | Deprecated |
| 0.1.x | ^4.9.0 | >=12.0.0 | EOL |

### Industry Best Practices

**Popular packages using similar approaches:**

- **Mongoose**: Version-locked approach with major version updates
- **TypeORM**: Specific version ranges with compatibility matrix
- **Prisma**: Exact version matching for database drivers
- **Sequelize**: Version-locked with migration guides

**Our approach aligns with industry standards for enterprise-grade packages.**

### Handling MongoDB Updates

#### For Package Users

1. **Automatic Updates** (Recommended)
   ```bash
   # Update package to latest version
   npm update @soapjs/soap-node-mongo
   
   # Check if MongoDB driver needs updating
   npm list mongodb
   ```

2. **Manual Updates** (When needed)
   ```bash
   # Update to specific package version
   npm install @soapjs/soap-node-mongo@0.3.0
   
   # Update MongoDB driver if required
   npm install mongodb@^6.3.0
   ```

3. **Version Conflicts**
   ```bash
   # If you need a different MongoDB version
   npm install mongodb@^6.4.0 --force
   
   # Check compatibility
   npm run test:unit
   ```

#### For Package Maintainers

1. **Testing New MongoDB Versions**
   ```bash
   # Test against new MongoDB version
   npm install mongodb@^6.4.0 --save-dev
   npm run test:unit
   
   # Run integration tests
   npm run test:integration
   ```

2. **Release Process**
   ```bash
   # Update peer dependency
   # Update compatibility matrix
   # Run full test suite
   # Update documentation
   # Release new version
   ```

### Breaking Changes Policy

- **Major versions**: May include breaking changes
- **Minor versions**: New features, backward compatible
- **Patch versions**: Bug fixes, backward compatible

### Security Updates

- **Critical security patches**: Released immediately as patch versions
- **Non-critical updates**: Released in regular version cycles
- **Vulnerability reporting**: Via GitHub Issues or security@soapjs.com
