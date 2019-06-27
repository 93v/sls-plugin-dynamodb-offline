# sls-plugin-dynamodb-offline

![CircleCI](https://img.shields.io/circleci/build/github/93v/sls-plugin-dynamodb-offline.svg)
![David](https://img.shields.io/david/dev/93v/sls-plugin-dynamodb-offline.svg)
![GitHub code size in bytes](https://img.shields.io/github/languages/code-size/93v/sls-plugin-dynamodb-offline.svg)
![GitHub repo size](https://img.shields.io/github/repo-size/93v/sls-plugin-dynamodb-offline.svg)
![npm](https://img.shields.io/npm/dw/sls-plugin-dynamodb-offline.svg)
![npm](https://img.shields.io/npm/dm/sls-plugin-dynamodb-offline.svg)
![npm](https://img.shields.io/npm/dy/sls-plugin-dynamodb-offline.svg)
![npm](https://img.shields.io/npm/dt/sls-plugin-dynamodb-offline.svg)
![NPM](https://img.shields.io/npm/l/sls-plugin-dynamodb-offline.svg)
![npm](https://img.shields.io/npm/v/sls-plugin-dynamodb-offline.svg)
![GitHub last commit](https://img.shields.io/github/last-commit/93v/sls-plugin-dynamodb-offline.svg)
![npm collaborators](https://img.shields.io/npm/collaborators/sls-plugin-dynamodb-offline.svg)

Serverless Framework Plugin to Work with AWS DynamoDB Offline

## Installation

To install with npm, run this in your service directory:

```bash
npm install --save-dev sls-plugin-dynamodb-offline
```

Then add this to your `serverless.yml`

```yml
plugins:
  - sls-plugin-dynamodb-offline
```

> Important:
> To run DynamoDB on your computer, you must have the Java Runtime Environment
> (JRE) version 6.x or newer. The application doesn't run on earlier JRE versions.

## How it works

The plugin downloads the official DynamoDB (Downloadable Version) on Your
Computer and allows the serverless app to launch it with the full set of
supported configurations

## Configuration

To configure DynamoDB Offline, add a `dynamodb` section like this to your
`serverless.yml`:

```yml
custom:
  dynamodb:
    # TODO: Implement this
    # If you only want to use DynamoDB Offline in some stages, declare them here
    stages:
      - dev
    start:
      # Here you cane use all of the command line options described at
      # https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.UsageNotes.html
      cors: "*" # Enables support for cross-origin resource sharing (CORS) for JavaScript. You must provide a comma-separated "allow" list of specific domains. The default setting for [cors] is an asterisk (*), which allows public access.
      dbPath: "/tmp" # The directory where DynamoDB writes its database file. If you don't specify this option, the file is written to the current directory. You can't specify both [dbPath] and [inMemory] at once.
      delayTransientStatuses: true # Causes DynamoDB to introduce delays for certain operations. DynamoDB (Downloadable Version) can perform some tasks almost instantaneously, such as create/update/delete operations on tables and indexes. However, the DynamoDB service requires more time for these tasks. Setting this parameter helps DynamoDB running on your computer simulate the behavior of the DynamoDB web service more closely. (Currently, this parameter introduces delays only for global secondary indexes that are in either CREATING or DELETING status.)
      inMemory: true # DynamoDB runs in memory instead of using a database file. When you stop DynamoDB, none of the data is saved. You can't specify both [dbPath] and [inMemory] at once.
      optimizeDbBeforeStartup: true # Optimizes the underlying database tables before starting DynamoDB on your computer. You also must specify [dbPath] when you use this parameter.
      port: 8000 # The port number that DynamoDB uses to communicate with your application. If you don't specify this option, the default port is 8000. If port 8000 is unavailable, this command throws an exception. You can use the port option to specify a different port number
      sharedDb: true # If you specify [sharedDb], DynamoDB uses a single database file instead of separate files for each credential and Region.

      # Some java -Xms arguments can also be provided as configs
      heapInitial: "2048m" # Initial heap size for [java -Xms] arguments
      heapMax: "1g" # Maximum heap size for [java -Xmx] arguments

      # The plugin itself has a few helpful configuration options
      migrate: true # After starting dynamodb local, create DynamoDB tables from the current serverless configuration.
      noStart: false # Does not start the DynamoDB. This option is useful if you already have a running instance of DynamoDB locally
```

## TODO

- Add tests
- Implement stages config
- Implement seeding
- Get Access and Secret Keys from env and then fallback
