import { GatewayPrivateKeyGenerator, SolidPrivateKeyGenerator } from './private-key-generators';

export class GatewayIdentityCreator {
  private _privateKeyGenerator

  constructor({privateKeyGenerator} : {privateKeyGenerator : GatewayPrivateKeyGenerator}) {

  }

  createIdentity({userName, password, seedPhrase}) {

  }
}

export class SolidIdentityCreator {
  constructor({solidServerUri, privateKeyGenerator} :
              {solidServerUri : string, privateKeyGenerator : SolidPrivateKeyGenerator})
  {

  }

  createIdentity({userName, seedPhrase}) {

  }
}

export class EthereumIdentityCreator {
  createIdentity({seedPhrase}) {

  }
}
