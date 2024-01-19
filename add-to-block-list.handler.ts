import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import { snsTopic } from './sns';

const queue = new aws.sqs.Queue('ses-notifications-queue', {
  fifoQueue: false,
  namePrefix: 'ses-notifications-queue',
  sqsManagedSseEnabled: true,
});

const allowSNSToQueueMessages = aws.iam.getPolicyDocumentOutput({
  statements: [
    {
      sid: 'AllowSNSToQueueMessages',
      effect: 'Allow',
      actions: ['sqs:SendMessage'],
      resources: [queue.arn],
      principals: [
        {
          type: '*',
          identifiers: ['*'],
        },
      ],
      conditions: [
        {
          test: 'ArnEquals',
          variable: 'aws:SourceArn',
          values: [snsTopic.arn],
        },
      ],
    },
  ],
});

const allowSNSToQueueMessagesPolicy = new aws.sqs.QueuePolicy(
  'allow-sns-to-queue-messages-policy',
  {
    queueUrl: queue.id,
    policy: allowSNSToQueueMessages.apply(policy => policy.json),
  },
);

const addToBlockListHandler = new aws.sns.TopicSubscription(
  'add-to-block-list-handler',
  {
    topic: snsTopic.arn,
    protocol: 'sqs',
    endpoint: queue.arn,
    filterPolicyScope: 'MessageBody',
    filterPolicy: JSON.stringify({ notificationType: ['Bounce'] }),
  },
);

const dynamoTable = new aws.dynamodb.Table('block-list-table', {
  name: 'blocklist',
  attributes: [
    {
      name: 'email',
      type: 'S',
    },
  ],
  hashKey: 'email',
  readCapacity: 1,
  writeCapacity: 1,
});

const assumeRolePolicy = aws.iam.getPolicyDocument({
  statements: [
    {
      effect: 'Allow',
      actions: ['sts:AssumeRole'],
      principals: [
        {
          type: 'Service',
          identifiers: ['lambda.amazonaws.com'],
        },
      ],
    },
  ],
});

const iamForLambda = new aws.iam.Role('lambda-execution-role', {
  name: 'LambdaExecutionRole',
  assumeRolePolicy: assumeRolePolicy.then(policy => policy.json),
});

new aws.iam.RolePolicyAttachment('execution-role-policy-attachment', {
  role: iamForLambda.name,
  policyArn:
    'arn:aws:iam::aws:policy/service-role/AWSLambdaSQSQueueExecutionRole',
});

const allowLambdaToAccessDynamoDb = aws.iam.getPolicyDocumentOutput({
  statements: [
    {
      effect: 'Allow',
      actions: ['dynamodb:*'],
      resources: [dynamoTable.arn],
    },
  ],
});

const allowLambdaToAccessDynamoDbPolicy = new aws.iam.Policy(
  'allow-lambda-to-access-dynamo-db-policy',
  {
    name: 'AllowLambdaToAccessDynamoDb',
    policy: allowLambdaToAccessDynamoDb.apply(policy => policy.json),
  },
);

new aws.iam.RolePolicyAttachment('lambda-dynamodb-policy-attachment', {
  role: iamForLambda.name,
  policyArn: allowLambdaToAccessDynamoDbPolicy.arn,
});

const codeZip = new pulumi.asset.AssetArchive({
  'index.mjs': new pulumi.asset.FileAsset('./lambda.mjs'),
});

export const lambda = new aws.lambda.Function('add-to-block-list-lambda', {
  name: 'add-to-block-list-handler',
  code: codeZip,
  role: iamForLambda.arn,
  handler: 'index.handler',
  runtime: 'nodejs20.x',
  environment: {
    variables: {
      TABLE_NAME: dynamoTable.name,
    },
  },
});

new aws.lambda.EventSourceMapping('sqs-lambda-mapping', {
  eventSourceArn: queue.arn,
  functionName: lambda.arn,
});
