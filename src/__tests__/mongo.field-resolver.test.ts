import { MongoFieldResolver } from "../mongo.field-resolver";
import { PropertyInfo } from "@soapjs/soap";

describe("MongoFieldResolver", () => {
  let resolver: MongoFieldResolver<any>;

  beforeEach(() => {
    const fieldMappings: Record<string, PropertyInfo> = {
      name: { name: "name", type: "string" },
      age: { name: "age", type: "number" },
      email: { name: "email", type: "string" },
    };
    resolver = new MongoFieldResolver(fieldMappings);
  });

  describe("getDatabaseFieldName", () => {
    it("should return the mapped database field name", () => {
      expect(resolver.getDatabaseFieldName("name")).toBe("name");
      expect(resolver.getDatabaseFieldName("age")).toBe("age");
      expect(resolver.getDatabaseFieldName("email")).toBe("email");
    });

    it("should return the original field name if no mapping exists", () => {
      expect(resolver.getDatabaseFieldName("unknownField")).toBe("unknownField");
    });
  });

  describe("transformToDocument", () => {
    it("should transform entity to document with field mappings", () => {
      const entity = {
        name: "John Doe",
        age: 30,
        email: "john@example.com",
      };

      const document = resolver.transformToDocument(entity);

      expect(document).toEqual({
        name: "John Doe",
        age: 30,
        email: "john@example.com",
      });
    });

    it("should handle missing fields gracefully", () => {
      const entity = {
        name: "John Doe",
        // age is missing
        email: "john@example.com",
      };

      const document = resolver.transformToDocument(entity);

      expect(document).toEqual({
        name: "John Doe",
        email: "john@example.com",
      });
    });
  });

  describe("transformToEntity", () => {
    it("should transform document to entity with field mappings", () => {
      const document = {
        name: "John Doe",
        age: 30,
        email: "john@example.com",
      };

      const entity = resolver.transformToEntity(document);

      expect(entity).toEqual({
        name: "John Doe",
        age: 30,
        email: "john@example.com",
      });
    });

    it("should handle extra fields in document", () => {
      const document = {
        name: "John Doe",
        age: 30,
        email: "john@example.com",
        extraField: "extra value",
      };

      const entity = resolver.transformToEntity(document);

      expect(entity).toEqual({
        name: "John Doe",
        age: 30,
        email: "john@example.com",
        extraField: "extra value",
      });
    });
  });

  describe("addFieldMapping", () => {
    it("should add a new field mapping", () => {
      resolver.addFieldMapping("newField", { name: "new_field", type: "string" });

      expect(resolver.getDatabaseFieldName("newField")).toBe("new_field");
    });
  });

  describe("getFieldMappings", () => {
    it("should return all field mappings", () => {
      const mappings = resolver.getFieldMappings();

      expect(mappings).toEqual({
        name: { name: "name", type: "string" },
        age: { name: "age", type: "number" },
        email: { name: "email", type: "string" },
      });
    });
  });
});
