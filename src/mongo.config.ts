import { ConfigVars } from "@soapjs/soap";

export class MongoConfig {
  /**
   * Builds a MongoDB configuration object based on the provided configuration variables.
   *
   * @param {ConfigVars} configVars - The configuration variables object.
   * @param {string} [prefix=''] - The prefix to prepend to the configuration variable names.
   * @returns {MongoConfig} The MongoDB configuration object.
   */
  static create(configVars: ConfigVars, prefix = "") {
    const p = prefix
      ? prefix.endsWith("_")
        ? prefix.toUpperCase()
        : prefix.toUpperCase() + "_"
      : "";

    return new MongoConfig(
      configVars.getStringEnv(`${p}MONGO_DB_NAME`),
      configVars.getArrayEnv(`${p}MONGO_HOSTS`),
      configVars.getArrayEnv(`${p}MONGO_PORTS`),
      configVars.getStringEnv(`${p}MONGO_USER`),
      configVars.getStringEnv(`${p}MONGO_PASSWORD`),
      configVars.getStringEnv(`${p}MONGO_AUTH_MECHANISM`),
      configVars.getStringEnv(`${p}MONGO_AUTH_SOURCE`),
      configVars.getBooleanEnv(`${p}MONGO_SSL`),
      configVars.getStringEnv(`${p}MONGO_REPLICA_SET`),
      configVars.getBooleanEnv(`${p}MONGO_SRV`)
    );
  }

  constructor(
    public readonly database: string,
    public readonly hosts: string[],
    public readonly ports?: (number | string)[],
    public readonly user?: string,
    public readonly password?: string,
    public readonly authMechanism?: string,
    public readonly authSource?: string,
    public readonly ssl?: boolean,
    public readonly replicaSet?: string,
    public readonly srv?: boolean
  ) {}
}

export class MongoModuleVersion {
  static create(version: string) {
    const [major, minor, patch] = version.split(".");
    return new MongoModuleVersion(version, +major, +minor, +patch);
  }

  private constructor(
    private version: string,
    public readonly major: number,
    public readonly minor: number,
    public readonly patch: number
  ) {}

  toString() {
    return this.version;
  }
}
