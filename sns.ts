import * as aws from '@pulumi/aws';

export const snsTopic = new aws.sns.Topic('ses-notifications', {
  fifoTopic: false,
  namePrefix: 'ses-notifications',
});
