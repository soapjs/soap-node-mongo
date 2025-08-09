import * as Soap from "@soapjs/soap";
import * as mongoDb from "mongodb";
import { MongoPerformanceConfig } from "./mongo.performance";

export type CollectionOptions<T> = Soap.SourceOptions<T> & {
  indexes?: mongoDb.IndexDescription[];
  performanceMonitoring?: Partial<MongoPerformanceConfig>;
};

export type MongoAggregateParams = {
  pipeline: object[];
  options?: mongoDb.AggregateOptions;
};

export type MongoFindQueryParams<T = unknown> = {
  filter: mongoDb.Filter<T>;
  options?: mongoDb.FindOptions;
};

export type MongoUpdateQueryParams<T = unknown> = {
  filter: mongoDb.Filter<T>;
  update: mongoDb.UpdateFilter<T>;
  options?: mongoDb.UpdateOptions;
  method?: Soap.UpdateMethod;
};

export type MongoCountQueryParams<T = unknown> = {
  filter: mongoDb.Filter<T>;
  options?: mongoDb.CountDocumentsOptions;
};

export type MongoDeleteQueryParams<T = unknown> = {
  filter: mongoDb.Filter<T>;
  options?: mongoDb.DeleteOptions;
};

export type MongoInsertQueryParams<T = unknown> = {
  documents: T[];
  options?: mongoDb.BulkWriteOptions;
};
