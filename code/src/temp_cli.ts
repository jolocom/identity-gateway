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

  //Create and query transaction

  bdbint.createBDBTransaction({seedPhrase:'super batman secure seed string',assetdata:assetdata,metadata:metadata})
  .then((id)=> {
    bdbint.queryBigchainDB({contractID: assetdata.bicycle.serial_number, contractHash:'' })
    .then(res => {
      console.log('query: '+JSON.stringify(res))})

      .then(() => bdbint.createOwnershipClaim({seedPhrase:'super batman secure seed string',identityURL:'claim1',contractID:'contract1'}))
      .then((tx) => {console.log('Ownership created' + JSON.stringify(tx.id))})
      .then(() => bdbint.createFunctionalityClaim({seedPhrase:'super batman secure seed string',identityURL:'claim1',sourceIdentityURL:'sourceIdentity', contractID:'contract1'}))
      .then((tx)=> { console.log('Functionality created' + JSON.stringify(tx.id)) })
      .then(() => bdbint.createSecurityClaim({seedPhrase:'super batman secure seed string', identityURL:'claim1', contractID:'contract1', sourceIdentityURL:'source3', level:5}))
      .then((tx) => {console.log('Security created' + JSON.stringify(tx.id))})

      .then(() => bdbint._retrieveContractInfo({identityURL:'claim1', contractID:'contract1', contractHash:''}))
      .then((tx) => {console.log('Retrieve all' + JSON.stringify(tx))})

  })


  // Create ownershipClaim
  // bdbint.createOwnershipClaim({seedPhrase:'super batman secure seed string',identityURL:'claim1',contractID:'contract1'}).then((tx)=>{
  //     console.log('Ownership created' + JSON.stringify(tx))
  // })
  //
  //
  //createFunctionalityClaim
  // bdbint.createFunctionalityClaim({seedPhrase:'super batman secure seed string',identityURL:'claim1',sourceIdentityURL:'sourceIdentity', contractID:'contract1'}).then((tx)=>{
  //     console.log('Functionality created' + JSON.stringify(tx))
  // })
  //
  //
  // //createSecurityClaim
  // bdbint.createSecurityClaim({seedPhrase:'super batman secure seed string', identityURL:'claim1', contractID:'contract1', sourceIdentityURL:'source3', level:5}).then((tx)=>{
  //   console.log('Security created' + JSON.stringify(tx))
  // })
  //
  //
  // bdbint._retrieveContractInfo({identityURL:'claim1', contractID:'contract1', contractHash:''})

})
