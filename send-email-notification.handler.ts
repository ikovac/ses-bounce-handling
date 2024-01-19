import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { snsTopic } from './sns';

const config = new pulumi.Config();

export const subscription = new aws.sns.TopicSubscription(
  'send-email-notification-handler',
  {
    topic: snsTopic.arn,
    protocol: 'email-json',
    endpoint: config.require('email'),
    filterPolicyScope: 'MessageBody',
    filterPolicy: JSON.stringify({ notificationType: ['Bounce'] }),
  },
);
