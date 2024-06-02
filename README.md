# @soapjs/soap-node-mongo

This package provides MongoDB integration for the SoapJS framework, enabling seamless interaction with MongoDB databases and ensuring that your data access layer is clean, efficient, and scalable.

## Features

- Easy-to-use MongoDB collections and query factories.
- Integration with the SoapJS framework for structured, clean architecture.
- Support for MongoDB operations such as find, insert, update, and delete.
- Custom error handling to improve debugging and error resolution.
- Compatibility with various MongoDB versions, with support for different features based on version detection.

## Installation

Remember to have `mongodb` and `@soapjs/soap` installed in your project in which you want to use this package.

Install the package using npm:

```bash
npm install @soapjs/soap-node-mongo
```

## Usage

### 1. Import the necessary components from the package:

   ```typescript
   import {
     MongoSource,
     MongoConfig
   } from '@soapjs/soap-node-mongo';
   ```

### 2. Set up your MongoDB configuration:

   ```typescript
   const config = new MongoConfig({
     database: 'yourDatabase',
     hosts: ['localhost'],
     ports: [27017],
     user: 'yourUser',
     password: 'yourPassword'
     // additional config parameters
   });
   ```

### 3. Create a new `SoapMongo` driver instance:

   ```typescript
   const soapMongo = await SoapMongo.create(config);
   ```

### 4. Using `MongoSource` for Database Operations

The `MongoSource` class in `@soapjs/soap` provides a flexible way to interact with MongoDB collections, supporting a range of customization options through its constructor. This allows you to configure how `MongoSource` handles data mapping, query generation, and other aspects of database operations. Here’s how you can utilize these options:

#### Basic Usage
To use `MongoSource`, you typically need an instance of `SoapMongo`, the collection name, and optionally, configuration options. Here’s a basic example:

```typescript
import { SoapMongo, MongoSource } from '@soapjs/soap-node-mongo';
import { MyDocumentClass } from 'path_to_document_class';

const mongoSource = new SoapMongo(client, database);
const collection = new MongoSource<MyDocumentClass>(
  mongoSource,
  'myCollectionName',
  { modelClass: MyDocumentClass }
);
```

#### Configuration Options

When creating a `MongoSource` instance, you can provide additional options to customize its behavior:

- **`modelClass`**: Specifies a class that will be used for type mapping and potentially for applying decorators that help with serializing and deserializing the data.
  
  ```typescript
  { modelClass: MyDocumentClass }
  ```

- **`modelFieldMappings`**: Provides a way to explicitly define how fields in your documents should map to fields in your database models. This is useful when you do not have a model class or when you want to override default behavior.

  ```typescript
  { modelFieldMappings: { 'fieldInClass': { name: 'field_in_db', type: 'string' } } }
  ```

- **`queries`**: Allows passing a custom `MongoQueryFactory` instance if you have specific query handling needs that the default factory does not meet. This could include custom query logic, special parameter handling, or optimizations.

  ```typescript
  { queries: new MongoQueryFactory<MyDocumentClass>(/* custom configurations */) }
  ```

#### Advanced Configuration Example

Here’s how you might configure a `MongoSource` with a custom query factory and field mappings:

```typescript
import { MongoQueryFactory, MongoSource } from '@soapjs/soap';
import { MyCustomQueryFactory } from 'path_to_custom_factory';
import { MyDocumentClass } from 'path_to_document_class';

const customQueryFactory = new MyCustomQueryFactory({
  // Custom configuration for the factory
});

const collection = new MongoSource<MyDocumentClass>(
  mongoSource,
  'myCollectionName',
  {
    modelClass: MyDocumentClass,
    modelFieldMappings: {
      'propertyName': { name: 'databaseFieldName', type: 'string' }
    },
    queries: customQueryFactory
  }
);
```

## Documentation

For detailed documentation and additional usage examples, visit [SoapJS documentation](https://docs.soapjs.com).


## Issues
If you encounter any issues, please feel free to report them [here](https://github.com/soapjs/soap/issues/new/choose).

## Contact
For any questions, collaboration interests, or support needs, you can contact us through the following:

- Official:
  - Email: [contact@soapjs.com](mailto:contact@soapjs.com)
  - Website: https://soapjs.com
- Radoslaw Kamysz:
  - Email: [radoslaw.kamysz@gmail.com](mailto:radoslaw.kamysz@gmail.com)
  - Warpcast: [@k4mr4ad](https://warpcast.com/k4mr4ad)
  - Twitter: [@radoslawkamysz](https://x.com/radoslawkamysz)

## License

@soapjs/soap-node-mongo is [MIT licensed](./LICENSE).
