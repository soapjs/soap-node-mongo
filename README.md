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

1. Import the necessary components from the package:

   ```typescript
   import {
     MongoCollection,
     MongoConfig,
     MongoQueryFactory,
     MongoSource,
     MongoUtils
   } from '@soapjs/soap-node-mongo';
   ```

2. Set up your MongoDB configuration:

   ```typescript
   const config = new MongoConfig({
     database: 'yourDatabase',
     hosts: ['localhost'],
     ports: ['27017'],
     user: 'yourUser',
     password: 'yourPassword'
     // additional config parameters
   });
   ```

3. Create a new `MongoSource` instance:

   ```typescript
   const mongoSource = await MongoSource.create(config);
   ```

4. Use `MongoCollection` to perform database operations:

   ```typescript
   const collection = new MongoCollection<MyDocumentType>(mongoSource, 'myCollectionName');
   const documents = await collection.find({ filter: { status: 'active' } });
   ```

5. Utilize `MongoQueryFactory` for building complex queries and aggregations:

   ```typescript
   const queryFactory = new MongoQueryFactory();
   const params = FindParams.create({
     where: new Where().valueOf('customer').isEq(userId)
   });
   const { filter, options } = queryFactory.createFindQuery(params);
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
