import * as mongoDb from "mongodb";
import { DatabaseSessionRegistry, DatabaseSession } from "@soapjs/soap";
import { MongoDatabaseSession } from "./mongo.transaction";

/**
 * MongoDB implementation of DatabaseSessionRegistry.
 */
export class MongoSessionManager implements DatabaseSessionRegistry {
  private sessions = new Map<string, DatabaseSession>();

  constructor(private client: mongoDb.MongoClient) {}

  /**
   * Gets the transaction scope.
   * @returns {any} The transaction scope.
   */
  get transactionScope(): any {
    return {
      client: this.client,
    };
  }

  /**
   * Creates a new database session.
   * @param {...unknown[]} args - Additional arguments required for session creation.
   * @returns {DatabaseSession} The created database session.
   */
  createSession(...args: unknown[]): DatabaseSession {
    const session = new MongoDatabaseSession(this.client);
    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Deletes a database session by its identifier.
   * @param {string} id - The unique identifier of the session to be deleted.
   * @param {...unknown[]} args - Additional arguments required for session deletion.
   */
  deleteSession(id: string, ...args: unknown[]): void {
    const session = this.sessions.get(id);
    if (session) {
      session.end();
      this.sessions.delete(id);
    }
  }

  /**
   * Retrieves a database session by its identifier.
   * @param {string} id - The unique identifier of the session to be retrieved.
   * @param {...unknown[]} args - Additional arguments required for session retrieval.
   * @returns {DatabaseSession | undefined} The retrieved database session, or undefined if no session exists for the given identifier.
   */
  getSession(id: string, ...args: unknown[]): DatabaseSession | undefined {
    return this.sessions.get(id);
  }

  /**
   * Checks if a session exists for the given identifier.
   * @param {string} id - The unique identifier of the session to be checked.
   * @returns {boolean} True if a session exists for the given identifier, otherwise false.
   */
  hasSession(id: string): boolean {
    return this.sessions.has(id);
  }

  /**
   * Gets all active sessions.
   * @returns {DatabaseSession[]} Array of all active sessions.
   */
  getAllSessions(): DatabaseSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Clears all sessions.
   */
  clearSessions(): void {
    for (const session of this.sessions.values()) {
      session.end();
    }
    this.sessions.clear();
  }
}
