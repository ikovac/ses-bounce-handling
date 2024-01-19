import * as emailNotificationsHandler from './send-email-notification.handler';
import * as blockListHandler from './add-to-block-list.handler';

export const notificationEmail =
  emailNotificationsHandler.subscription.endpoint;
export const lambda = blockListHandler.lambda.name;
