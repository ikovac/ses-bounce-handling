import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async event => {
  const records = event.Records;
  const emails = records.reduce((acc, it) => {
    const body = JSON.parse(it.body);
    const message = JSON.parse(body.Message);
    const bouncedRecipients = message.bounce.bouncedRecipients.map(
      r => r.emailAddress,
    );
    return [...acc, ...bouncedRecipients];
  }, []);

  const pResult = emails.map(email => {
    const command = new PutCommand({
      TableName: process.env.TABLE_NAME,
      Item: { email },
    });
    return docClient.send(command);
  });
  await Promise.all(pResult);
};
