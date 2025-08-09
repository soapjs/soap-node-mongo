// Polyfills for testcontainers compatibility
import { MongoClient } from 'mongodb';
import { MongoDBContainer, StartedMongoDBContainer } from '@testcontainers/mongodb';

// Global test database configuration
export const TEST_CONFIG = {
  timeout: 30000,
};

// Global test container and client
export let testContainer: StartedMongoDBContainer;
export let testClient: MongoClient;
export let testDb: any;

beforeAll(async () => {
  try {
    // Start MongoDB container
    testContainer = await new MongoDBContainer('mongo:6.3')
      .withExposedPorts(27017)
      .start();
    
    // Get connection details
    const host = testContainer.getHost();
    const port = testContainer.getMappedPort(27017);
    const connectionString = `mongodb://${host}:${port}`;
    
    // Connect to the containerized MongoDB
    testClient = new MongoClient(connectionString, {
      connectTimeoutMS: TEST_CONFIG.timeout,
      socketTimeoutMS: TEST_CONFIG.timeout,
    });
    
    await testClient.connect();
    testDb = testClient.db('soapjs_test');
    
    console.log(`✅ Connected to test database: soapjs_test (${connectionString})`);
  } catch (error) {
    console.error('❌ Failed to start MongoDB container or connect:', error);
    throw error;
  }
});

afterAll(async () => {
  if (testClient) {
    await testClient.close();
    console.log('🔌 Disconnected from test database');
  }
  
  if (testContainer) {
    await testContainer.stop();
    console.log('🛑 Stopped MongoDB container');
  }
});

// Clean up collections before each test
beforeEach(async () => {
  if (testDb) {
    const collections = await testDb.listCollections().toArray();
    for (const collection of collections) {
      await testDb.collection(collection.name).deleteMany({});
    }
  }
});

// Helper function to create test data
export const createTestData = async (collectionName: string, data: any[]) => {
  if (data.length > 0) {
    const result = await testDb.collection(collectionName).insertMany(data);
    return result.insertedIds;
  }
  return [];
};

// Helper function to get test data
export const getTestData = async (collectionName: string, filter = {}) => {
  return await testDb.collection(collectionName).find(filter).toArray();
};

// Helper function to count documents
export const countTestData = async (collectionName: string, filter = {}) => {
  return await testDb.collection(collectionName).countDocuments(filter);
};
