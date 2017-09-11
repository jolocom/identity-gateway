import * as _ from 'lodash'
import { AccessRights } from './access-rights';
import { AttributeStore } from './attribute-store';

export type AttributeNotificationSender = ({identity, userID, type, id}) => Promise<any>

export class AttributeNotifier {
  private _accessRights : AccessRights
  private _notificationSender : AttributeNotificationSender

  constructor(
    {accessRights, notificationSender} :
    {accessRights : AccessRights, notificationSender : AttributeNotificationSender}
  ) {
    this._accessRights = accessRights
    this._notificationSender = notificationSender
  }

  observe(attributeStore : AttributeStore) {
    attributeStore.events.addListener('attribute.created',
      ({...args}) => this.notify({event: 'created', ...args})
    )
    attributeStore.events.addListener('attribute.updated',
      ({...args}) => this.notify({event: 'updated', ...args})
    )
  }

  async notify({event, userId, type, id, value}) {
    const path = `/identity/${type}/${id}*`
    const rules = await this._accessRights.list({userID: userId, path})
    const identities = _(rules).map(rule => rule.identity).uniq().valueOf()
    identities.map(identity => this._notificationSender({identity, userID: userId, type, id}))
  }
}
