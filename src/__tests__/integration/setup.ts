import { MongoClient } from 'mongodb';
import { MongoDBContainer, StartedMongoDBContainer } from '@testcontainers/mongodb';

// Global test database configuration
export const TEST_CONFIG = {
  timeout: parseInt(process.env.MONGO_TEST_TIMEOUT || '30000'),
};

// Global test container and client
export let testContainer: StartedMongoDBContainer | null = null;
export let testClient: MongoClient;
export let testDb: any;

// Function to wait for MongoDB to be ready
const waitForMongoReady = async (client: MongoClient, dbName: string): Promise<void> => {
  const maxAttempts = 30; // 30 attempts
  const delayMs = 1000; // 1 second between attempts
  
  console.log('🔄 Waiting for MongoDB to become ready...');
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Try to ping the database
      await client.db(dbName).admin().ping();
      console.log(`✅ MongoDB is ready (attempt ${attempt}/${maxAttempts})`);
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        console.error('❌ MongoDB failed to become ready after maximum attempts');
        throw new Error(`MongoDB failed to become ready after ${maxAttempts} attempts: ${error}`);
      }
      
      // Only log every 5th attempt to avoid spam
      if (attempt % 5 === 0 || attempt === 1) {
        console.log(`⏳ Waiting for MongoDB to be ready... (attempt ${attempt}/${maxAttempts})`);
      }
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
};

// Setup function that can be called from tests
export const setupTestDatabase = async () => {
  try {
    // Check if we should use environment-based connection
    const testUrl = process.env.MONGO_TEST_URL;
    const testDbName = process.env.MONGO_TEST_DB || 'soapjs_test';
    
    if (testUrl) {
      // Use environment-based connection
      console.log(`Using environment-based MongoDB connection: ${testUrl}`);
      testClient = new MongoClient(testUrl, {
        connectTimeoutMS: TEST_CONFIG.timeout,
        socketTimeoutMS: TEST_CONFIG.timeout,
      });
      
      await testClient.connect();
      testDb = testClient.db(testDbName);
      
      // Wait for MongoDB to be ready
      await waitForMongoReady(testClient, testDbName);
      
      console.log(`Connected to test database: ${testDbName} (${testUrl})`);
    } else {
      // Use testcontainers with MongoDB replication support
      console.log('No MONGO_TEST_URL found, using testcontainers...');
      testContainer = await new MongoDBContainer('mongo:5.0')
        .withExposedPorts(27017)
        .withStartupTimeout(120000)
        .start();
      
      const host = testContainer.getHost();
      const port = testContainer.getMappedPort(27017);
      const connectionString = `mongodb://${host}:${port}/?replicaSet=rs0&directConnection=true`;
      
      console.log(`📍 MongoDB connection: ${connectionString}`);
      
      testClient = new MongoClient(connectionString, {
        connectTimeoutMS: TEST_CONFIG.timeout,
        socketTimeoutMS: TEST_CONFIG.timeout,
        serverSelectionTimeoutMS: TEST_CONFIG.timeout,
        retryWrites: true,
        retryReads: true,
      });
      
      // Wait for MongoDB to be ready
      console.log('⏳ Waiting for MongoDB container to be ready...');
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      await testClient.connect();
      testDb = testClient.db(testDbName);
      
      // Wait for MongoDB to be ready
      await waitForMongoReady(testClient, testDbName);
      
      console.log(`Connected to test database: ${testDbName} (${connectionString})`);
    }
  } catch (error) {
    console.error('Failed to start MongoDB container or connect:', error);
    throw error;
  }
};

// Cleanup function that can be called from tests
export const cleanupTestDatabase = async () => {
  if (testClient) {
    try {
      await testClient.close();
      console.log('Disconnected from test database');
    } catch (error) {
      console.error('Error closing MongoDB client:', error);
    }
  }
  
  if (testContainer) {
    try {
      await testContainer.stop();
      console.log('Stopped MongoDB container');
    } catch (error) {
      console.error('Error stopping MongoDB container:', error);
    }
  }
};

// Clean up collections function
export const cleanupCollections = async () => {
  if (testDb) {
    try {
      const collections = await testDb.listCollections().toArray();
      for (const collection of collections) {
        await testDb.collection(collection.name).deleteMany({});
      }
      console.log(`Cleaned up ${collections.length} collections`);
    } catch (error) {
      console.error('Error cleaning up collections:', error);
      throw error;
    }
  }
};

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
