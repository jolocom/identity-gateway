require('regenerator-runtime/runtime')
import { initSequelize } from './sequelize/utils'
import * as Bdb from './bigchaindb-contracts'
import { DataSigner } from './data-signer'
import { PublicKeyRetrievers } from './verification-store'
import { WalletManager } from 'smartwallet-contracts/lib/manager';
import { MemoryGatewayIdentityStore, SequelizeGatewayIdentityStore } from './identity-store'
import * as openpgp from 'openpgp'
openpgp.initWorker({ path: '../node_modules/openpgp/dist/openpgp.worker.js' })

const DEVELOPMENT_MODE = process.env.NODE_ENV === 'dev'
var sequelize = undefined
var sequelizeModels = undefined

initSequelize({
  devMode: DEVELOPMENT_MODE
}).then((seq)=>{
  sequelize = seq.sequelize
  sequelizeModels = seq.sequelizeModels

  const identityStore = new SequelizeGatewayIdentityStore({
    identityModel: sequelizeModels.Identity,
    linkedIdentityModel: sequelizeModels.LinkedIdentity
  })

  const bdbint = new Bdb.BigChainInteractions({
    walletManager: WalletManager,
    dataSigner: new DataSigner({identityStore}),
    contractAddressRetriever: async ({identityURL, contractID}) : Promise<string> => {
      return (await 'fake')
    },
    signatureCheckers: {
      jolocom: async ({publicKey, signature, message}) => {
        const opts = {
          message: new openpgp.cleartext.CleartextMessage(message),
          publicKeys: openpgp.key.readArmored(publicKey).keys
        }
        if (signature) {
          opts['signature'] = openpgp.signature.readArmored(signature)
        }
        return (await openpgp.verify(opts)).signatures[0].valid
     },
     ethereum: async (url) => false,
     bigChain: async (url) => false
    }
  })

  const assetdata = {
          'bicycle': {
                  'serial_number': 'abcd1234',
                  'manufacturer': 'Bicycle Inc.',
          }
  }

  const metadata = {'planet': 'earth'}

  //Create transaction
  bdbint.createBDBTransaction({seedPhrase:'super batman secure seed string',assetdata:assetdata,metadata:metadata})

  //Create ownershipClaim
  bdbint.createOwnershipClaim({seedPhrase:'super batman secure seed string',identityURL:'claim1',contractID:'contract1'})


  //createFunctionalityClaim
  bdbint.createFunctionalityClaim({seedPhrase:'super batman secure seed string',identityURL:'claim2',sourceIdentityURL:'sourceIdentity', contractID:'contract2'})


  //Create SecurityClaim
  bdbint.createSecurityClaim({seedPhrase:'super batman secure seed string', identityURL:'claim3', contractID:'contract3', sourceIdentityURL:'source3', level:5})


})
