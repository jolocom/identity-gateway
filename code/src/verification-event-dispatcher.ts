import { VerificationStore } from './verification-store';

export class VerificationEventDispatcher {
  setup({clients, verificationStore} : {clients, verificationStore : VerificationStore}) {
    verificationStore.events.on('verification.stored', ({
        userId, attrType, attrId, verificationId
    }) => {
      const client = clients[userId]
      if (!client) {
        return
      }

      clients[userId].emit('verification.stored', {
        attrType, attrId, verificationId
      })
    })
  }
}
