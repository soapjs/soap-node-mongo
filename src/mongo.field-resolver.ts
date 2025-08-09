import { PropertyInfo } from "@soapjs/soap";

/**
 * MongoDB field resolver for handling field mappings between domain entities and database documents.
 * @template T - The type of the entity.
 */
export class MongoFieldResolver<T> {
  private fieldMappings: Record<string, PropertyInfo> = {};

  constructor(fieldMappings?: Record<string, PropertyInfo>) {
    if (fieldMappings) {
      this.fieldMappings = fieldMappings;
    }
  }

  /**
   * Gets the field mappings.
   * @returns {Record<string, PropertyInfo>} The field mappings.
   */
  getFieldMappings(): Record<string, PropertyInfo> {
    return this.fieldMappings;
  }

  /**
   * Adds a field mapping.
   * @param {string} entityField - The entity field name.
   * @param {PropertyInfo} propertyInfo - The property information.
   */
  addFieldMapping(entityField: string, propertyInfo: PropertyInfo): void {
    this.fieldMappings[entityField] = propertyInfo;
  }

  /**
   * Gets the database field name for a given entity field.
   * @param {string} entityField - The entity field name.
   * @returns {string} The database field name.
   */
  getDatabaseFieldName(entityField: string): string {
    const mapping = this.fieldMappings[entityField];
    return mapping ? mapping.name : entityField;
  }

  /**
   * Gets the entity field name for a given database field.
   * @param {string} dbFieldName - The database field name.
   * @returns {string | undefined} The entity field name.
   */
  getEntityFieldName(dbFieldName: string): string | undefined {
    for (const [entityField, mapping] of Object.entries(this.fieldMappings)) {
      if (mapping.name === dbFieldName) {
        return entityField;
      }
    }
    return undefined;
  }

  /**
   * Transforms an entity object to a database document.
   * @param {T} entity - The entity to transform.
   * @returns {Record<string, unknown>} The transformed document.
   */
  transformToDocument(entity: T): Record<string, unknown> {
    const document: Record<string, unknown> = {};
    
    for (const [entityField, value] of Object.entries(entity as Record<string, unknown>)) {
      const dbFieldName = this.getDatabaseFieldName(entityField);
      const mapping = this.fieldMappings[entityField];
      
      if (mapping?.transformer?.to) {
        document[dbFieldName] = mapping.transformer.to(value);
      } else {
        document[dbFieldName] = value;
      }
    }
    
    return document;
  }

  /**
   * Transforms a database document to an entity object.
   * @param {Record<string, unknown>} document - The document to transform.
   * @returns {T} The transformed entity.
   */
  transformToEntity(document: Record<string, unknown>): T {
    const entity: Record<string, unknown> = {};
    
    // First, transform mapped fields
    for (const [entityField, mapping] of Object.entries(this.fieldMappings)) {
      const dbFieldName = mapping.name;
      const value = document[dbFieldName];
      
      if (mapping.transformer?.from) {
        entity[entityField] = mapping.transformer.from(value);
      } else {
        entity[entityField] = value;
      }
    }
    
    // Then, add any fields that don't have explicit mappings
    for (const [dbFieldName, value] of Object.entries(document)) {
      const entityField = this.getEntityFieldName(dbFieldName);
      if (!entityField) {
        // If no mapping exists, use the database field name as is
        entity[dbFieldName] = value;
      }
    }
    
    return entity as T;
  }

  /**
   * Resolves a field by its domain name.
   * @param {string} domainFieldName - The domain field name.
   * @returns {PropertyInfo | undefined} The property information.
   */
  resolveByDomainField(domainFieldName: string): PropertyInfo | undefined {
    return this.fieldMappings[domainFieldName];
  }

  /**
   * Resolves a field by its database name.
   * @param {string} databaseFieldName - The database field name.
   * @returns {PropertyInfo | undefined} The property information.
   */
  resolveByDatabaseField(databaseFieldName: string): PropertyInfo | undefined {
    for (const [entityField, mapping] of Object.entries(this.fieldMappings)) {
      if (mapping.name === databaseFieldName) {
        return mapping;
      }
    }
    return undefined;
  }

  /**
   * Gets all property mappings.
   * @returns {Record<string, PropertyInfo>} All property mappings.
   */
  getAllPropertyMappings(): Record<string, PropertyInfo> {
    return { ...this.fieldMappings };
  }

  /**
   * Checks if a field has a mapping.
   * @param {string} fieldName - The field name.
   * @returns {boolean} True if the field has a mapping.
   */
  hasFieldMapping(fieldName: string): boolean {
    return fieldName in this.fieldMappings;
  }

  /**
   * Removes a field mapping.
   * @param {string} entityField - The entity field name.
   */
  removeFieldMapping(entityField: string): void {
    delete this.fieldMappings[entityField];
  }

  /**
   * Clears all field mappings.
   */
  clearFieldMappings(): void {
    this.fieldMappings = {};
  }
}
