import * as mongoDb from "mongodb";
import { DatabaseSession, AnyObject } from "@soapjs/soap";

/**
 * MongoDB implementation of DatabaseSession interface.
 */
export class MongoDatabaseSession implements DatabaseSession {
  private session: mongoDb.ClientSession | null = null;

  constructor(private client: mongoDb.MongoClient) {}

  /**
   * Gets the session ID.
   * @returns {string} The session ID.
   */
  get id(): string {
    return this.session?.id?.toString() || "";
  }

  /**
   * Ends the database session.
   * @param {AnyObject} [options] Session options.
   * @returns {Promise<void>} A promise that resolves when the session ends.
   */
  async end(options?: AnyObject): Promise<void> {
    if (this.session) {
      await this.session.endSession(options as mongoDb.EndSessionOptions);
      this.session = null;
    }
  }

  /**
   * Starts a database transaction.
   * @param {AnyObject} [options] Transaction options.
   * @returns {Promise<any>} A promise that resolves when the transaction starts.
   */
  async startTransaction(options?: AnyObject): Promise<any> {
    if (!this.session) {
      this.session = this.client.startSession();
    }
    await this.session.startTransaction(options as mongoDb.TransactionOptions);
    return this.session;
  }

  /**
   * Commits the database transaction.
   * @returns {Promise<void>} A promise that resolves when the transaction commits.
   */
  async commitTransaction(): Promise<void> {
    if (this.session) {
      await this.session.commitTransaction();
    }
  }

  /**
   * Rolls back the database transaction.
   * @returns {Promise<void>} A promise that resolves when the transaction rollbacks.
   */
  async rollbackTransaction(): Promise<void> {
    if (this.session) {
      await this.session.abortTransaction();
    }
  }

  /**
   * Gets the underlying MongoDB session.
   * @returns {mongoDb.ClientSession | null} The MongoDB session.
   */
  getMongoSession(): mongoDb.ClientSession | null {
    return this.session;
  }

  /**
   * Checks if the session is active.
   * @returns {boolean} True if the session is active.
   */
  isActive(): boolean {
    return this.session !== null;
  }

  /**
   * Gets the session options.
   * @returns {mongoDb.ClientSessionOptions | null} The session options.
   */
  getOptions(): mongoDb.ClientSessionOptions | null {
    // In newer MongoDB versions, ClientSession doesn't expose options directly
    // We'll return null or implement a different approach if needed
    return null;
  }
}
