import { GatewayIdentityStore } from '../identity-store';
import { PublicKeyRetriever } from '../verification-store'
import * as openpgp from 'openpgp'

export class OauthModel {
  private _gatewayIdentityStore : GatewayIdentityStore
  private _tokenStore : TokenStore
  private _publicKeyRetriever : PublicKeyRetriever

  constructor({gatewayIdentityStore, tokenStore, publicKeyRetriever} :
              {gatewayIdentityStore : GatewayIdentityStore,
               tokenStore : TokenStore,
               publicKeyRetriever : PublicKeyRetriever})
  {
    this._gatewayIdentityStore = gatewayIdentityStore
    this._tokenStore = tokenStore
    this._publicKeyRetriever = publicKeyRetriever
  }

  getAccessToken(bearerToken) {
    return this._tokenStore.getAccessToken(bearerToken)
  }

  getRefreshToken(bearerToken) {
    return this._tokenStore.getRefreshToken(bearerToken)
  }

  async getClient(clientId, clientSecret) {
    if (clientId.indexOf('https://') === 0) {
      const valid = await authenticateExternalIdentity({
        identity: clientId, signature: clientSecret,
        publicKeyRetriever: this._publicKeyRetriever
      })
      if (valid) {
        return {clientId, clientSecret}
      }
    }
  }

  async getUser(userName, password) {
    const userId = await this._gatewayIdentityStore.getUserIdBySeedPhrase(password)
    if (userId) {
      return {id: userId, userName, password}
    } else {
      return false
    }
  }

  saveToken(token, client, user) {
    return this._tokenStore.saveToken(token, client, user)
  }
}

export interface TokenStore {
  getAccessToken(bearerToken)
  getRefreshToken(bearerToken)
  saveToken(token, client, user)
}

export class MemoryTokenStore {
  public tokens = []

  constructor() {
    
  }

  getAccessToken(bearerToken) {
    var tokens = this.tokens.filter(function(token) {
      return token.accessToken === bearerToken;
    });

    return tokens.length ? tokens[0] : false;
  }

  getRefreshToken(bearerToken) {
    var tokens = this.tokens.filter(function(token) {
      return token.refreshToken === bearerToken;
    });

    return tokens.length ? tokens[0] : false;
  }

  saveToken(token, client, user) {
    this.tokens.push({
      accessToken: token.accessToken,
      accessTokenExpiresAt: token.accessTokenExpiresAt,
      clientId: client.clientId,
      refreshToken: token.refreshToken,
      refreshTokenExpiresAt: token.refreshTokenExpiresAt,
      userId: user.id
    })
  }
}

export async function authenticateExternalIdentity({identity, signature, publicKeyRetriever}) {
  const armoredPublicKey = this._publicKeyRetriever(identity)
  const result = await openpgp.verify({
    message: openpgp.cleartext.readArmored(identity),
    signature: openpgp.signature.readArmored(signature),
    publicKeys: openpgp.key.readArmored(armoredPublicKey).keys
  })
  return result.signatures[0].valid
}
