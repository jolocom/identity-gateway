import * as _ from 'lodash'
import { DataSigner } from './data-signer'
import * as driver from 'bigchaindb-driver'
import * as bip39 from 'bip39'
import * as ed25519 from 'ed25519'

const API_PATH = 'http://ec2-35-157-164-199.eu-central-1.compute.amazonaws.com:49994/api/v1/'

export interface SecurityClaim {
  identity : string
	level : number
	trustedVerifier : boolean
}

export interface MethodMap {
  [methodName : string] : {description : string}
}

export interface FunctionalityObject {
  name: string,
  description : string,
  timestamp: number,
	methods : MethodMap
}

export interface Functionality extends FunctionalityObject {
  verifications : Array<{identity, trustedVerifier : boolean}>
}

export interface SecurityClaimMap {
  [identity : string] : SecurityClaim
}

export interface ContractCheckResult {
  identityURL : string
  contractAddress : string

  currentSecurity : SecurityClaimMap
	lowestSecurityLevel : SecurityClaim
	highestSecurityLevel : SecurityClaim

	functionality : Functionality
	functionalityHistory? : Array<{
    timestamp : number, current : boolean, functionality: Functionality
  }>
}

export class ContractOwnershipError extends Error {
}

interface BigChainOwnershipClaim {
  assetData : string
  contractAddress : string
  identityURL : string

  bigChainPublicKey : string
  ethereumPublicKey : string
  jolocomPublicKey : string

  bigChainTransactionOwner : string
  ethereumSignature : string
  jolocomSignature : string
}

// PGP signed cleartext identity URL
interface creatorObject {
  identity : string,
  signature: string
}

interface BigChainFunctionalityObject {
  assetData : string,
  creator : creatorObject
  ownershipClaimPointer : string
  contractInfo: FunctionalityObject
}


interface BigChainFunctionalityClaim {
  assetData : string,
  creator : creatorObject
  ownershipClaimPointer : string
  functionalityObjectPointer : string
  contractHash : string
}

interface BigChainSecurityClaim {
  assetData : string,
  creator : creatorObject
  ownershipClaimPointer : string
  contractHash : string
  level : number
}

interface BigChainContractInfo {
  ownershipClaims : BigChainOwnershipClaim
  functionalityObjects : BigChainFunctionalityObject[]
  functionalityClaims : BigChainFunctionalityClaim[]
  securityClaims : BigChainSecurityClaim[]
}

type PublicKeyRetrievers = {[type : string]: (identityURL: string) => Promise<string>}
type ContractAddressRetriever = ({identityURL, contractID}) => Promise<string>

type SignatureCheckers = {[type : string] : (
  {publicKey, signature, message} :
  {publicKey : string, signature? : string, message : string}
) => Promise<boolean>}

// TODO Functioning key retriever
export class BigChainInteractions {
  private _walletManager
  private _dataSigner : DataSigner
  private _publicKeyRetrievers : PublicKeyRetrievers
  private _contractAddressRetriever : ContractAddressRetriever
  private _signatureCheckers : SignatureCheckers

  constructor({
      walletManager,
      dataSigner,
      publicKeyRetrievers,
      contractAddressRetriever,
      signatureCheckers
    } : {
      walletManager,
      dataSigner : DataSigner,
      publicKeyRetrievers : PublicKeyRetrievers,
      contractAddressRetriever : ContractAddressRetriever,
      signatureCheckers : SignatureCheckers
    })
  {
    this._walletManager = walletManager
    this._dataSigner = dataSigner
    this._publicKeyRetrievers = publicKeyRetrievers
    this._contractAddressRetriever = contractAddressRetriever
    this._signatureCheckers = signatureCheckers
  }

  createBDBTransaction({
    seedPhrase,
    assetdata,
    metadata
  }:{
    seedPhrase: string,
    assetdata: any,
    metadata: any
  }) : Promise<any> {
    this._getConnection()

    const keypair = new driver.Ed25519Keypair(bip39.mnemonicToSeed(seedPhrase).slice(0,32))
    const tx = driver.Transaction.makeCreateTransaction(
      assetdata,
      metadata,
      [
          driver.Transaction.makeOutput(
              driver.Transaction.makeEd25519Condition(keypair.publicKey))
      ],
      keypair.publicKey
    )
    // sign/fulfill the transaction
    const txSigned = driver.Transaction.signTransaction(tx, keypair.privateKey)

    // send it off to BigchainDB
    return this.conn.postTransaction(txSigned)
      .then(() => this.conn.pollStatusAndFetchTransaction(txSigned.id))
      .then(() => txSigned)
      .then(res => {
        console.log('Transaction id: '+ txSigned.id)
        return txSigned.id
      })
  }

  // TODO create correct signature
  async createOwnershipClaim({
    seedPhrase,
    identityURL,
    contractID
  } : {
    seedPhrase : string,
    identityURL : string,
    contractID : string
  }) {
    const assetdata = {asset : identityURL +':'+ contractID +':'+ 'ownership'}
    // console.log(this._publicKeyRetrievers)
    const contractAddress = await this._contractAddressRetriever({
      identityURL,
      contractID
    })

    // ETHEREUM SIGNATURES
    const ethereumKey = await this._getEthereumPubKey({seedPhrase})
    const ethereumSignature = await this._createEthereumSignature({
        seedPhrase,
        message: ethereumKey
    })

    const ethereumSection = {
      key: ethereumKey,
      signature: ethereumSignature
    }

    // JOLOCOM SIGNATURES
    const jolocomKey = await this._publicKeyRetrievers.url(identityURL)
    const { signature } = await this._dataSigner.signData({
      data: jolocomKey,
      seedPhrase
    })
    const jolocomSection = {
      key: jolocomKey,
      signature
    }
    //
    // BDB SIGNATURES
    const bdbKey =  await this._getBdbPublicKey({seedPhrase})

    const metadata = {
      identityURL,
      contractAddress,
      signedKeys: {
        bdb: bdbKey,
        ethereum: ethereumSection,
        jolocom: jolocomSection,
      }
    }

    return await this.createBDBTransaction({seedPhrase, assetdata, metadata})
  }

  async createFunctionalityObject({
    seedPhrase,
    identityURL,
    transactionID,
    contractID,
    contractInfo
  } : {
    seedPhrase : string,
    identityURL : string,
    transactionID: string,
    contractID : string,
    contractInfo: FunctionalityObject
  }) {
    const signedIdentityURL = await this._dataSigner.signData({
      data: identityURL,
      seedPhrase,
      combine: true
    })

    const assetdata = {asset: `${identityURL}:${contractID}:functionalityObject`}
    const metadata = {
      identityURL: signedIdentityURL.data,
      ownershipClaim: transactionID,
      functionalityObject: contractInfo
    }

    return this.createBDBTransaction({seedPhrase, assetdata, metadata})
  }

  async createFunctionalityClaim({
    seedPhrase,
    identityURL,
    sourceIdentityURL,
    contractID
  } : {
    seedPhrase : string,
    identityURL : string,
    sourceIdentityURL : string,
    contractID : string
  }) {
    const sourceIdentityURLSignature = await this._dataSigner.signData({
      data: identityURL, seedPhrase: seedPhrase
    })
    const assetdata = {
      asset: `${identityURL}:${contractID}:functionality`
    }
    const metadata = {
      functionalityObjectPointer:'TODO pointer_to_contract',
      creator: {
        identity: sourceIdentityURL,
        signature: sourceIdentityURLSignature.signature
      },
      contractHash: 'TODO',
      ownershipClaimPointer : 'TODO transactionID'
    }
    return this.createBDBTransaction({seedPhrase, assetdata, metadata})
  }

  async createSecurityClaim({
    seedPhrase,
    identityURL,
    contractID,
    sourceIdentityURL,
    level
  } : {
    seedPhrase : string,
    identityURL : string,
    contractID : string,
    sourceIdentityURL : string,
    level : number
  }) {
    const sourceIdentityURLSignature = await this._dataSigner.signData({
      data: identityURL, seedPhrase: seedPhrase
    })
    const assetdata = {
      asset: `${identityURL}:${contractID}:security`
    }
    const metadata = {
      sourceIdentityURL: sourceIdentityURL,
      ownershipClaimPointer: 'TODO',
      level,
      creator: {
        identity: sourceIdentityURL,
        signature: sourceIdentityURLSignature.signature
      },
      contractHash : 'TODO'
    }
    return this.createBDBTransaction({seedPhrase, assetdata, metadata})
  }

  // TODO CONTRACT HASH FUNCTION
  async checkContract({
    identityURL,
    contractID,
    retrieveHistory
  } : {
    identityURL : string,
    contractID : string,
    retrieveHistory? : boolean
  }) : Promise<ContractCheckResult | null> {
    // const contractAddress = await this._contractAddressRetriever({identityURL, contractID})
    // const contractHash = await this._retrieveContractHash({contractAddress})
    const contractInfo = await this._retrieveContractInfo({
      identityURL,
      contractID,
      contractHash: null
      // contractHash: !retrieveHistory ? contractHash : null
    })

    if (!contractInfo) {
      console.log("No contract ownership found")
      return null
    }

    const publicKeys = await this._retrievePublicKeys({contractInfo})
    const isOwnershipValid = await this._checkOwnershipValidity({
      contractInfo,
      publicKeys
    })

    if (!isOwnershipValid) {
      throw new ContractOwnershipError("Could not verify contract ownership")
    }

    return await this._buildContractCheckResult({
      publicKeys,
      contractInfo,
      // contractHash
    })
  }

  async _retrievePublicKeys({contractInfo} : {contractInfo : BigChainContractInfo}) {
    return {
      jolocom: contractInfo.ownershipClaims.jolocomPublicKey,
      ethereum: contractInfo.ownershipClaims.ethereumPublicKey,
      bigChain: contractInfo.ownershipClaims.bigChainPublicKey,
    }
  }

  async _checkOwnershipValidity({
    contractInfo,
    publicKeys
  } : {
    contractInfo : BigChainContractInfo, 
    publicKeys
  }) {
    const toCheck = [
      {type: 'jolocom', signature: contractInfo.ownershipClaims.jolocomSignature},
      {type: 'ethereum', signature: contractInfo.ownershipClaims.ethereumSignature}
      {type: 'bigChain', signature: contractInfo.ownershipClaims.bigChainTransactionOwner},
    ]
    const checked = await Promise.all(toCheck.map(check => {
      return this._signatureCheckers[check.type]({
        publicKey: publicKeys[check.type],
        signature: check.signature,
        message: contractInfo.ownershipClaims[`${check.type}PublicKey`]
      })
    }))
    return _.every(checked, (res) => {
      return res === true
    })
  }

  async _retrieveContractHash({contractAddress}){
    return ''
  }
  async _retrieveContractInfo({identityURL, contractID, contractHash}) : Promise<BigChainContractInfo> {
    var ownershipClaims: BigChainOwnershipClaim
    var functionalityClaims: BigChainFunctionalityClaim[] = []
    var securityClaims: BigChainSecurityClaim[] = []
    var functionalityObjects: BigChainFunctionalityObject[] = []

    this._getConnection()
    const searchResults = await this.conn.searchAssets('"'+ identityURL + ':' + contractID +':"')
    for (let asset of searchResults) {
      let transaction = await this.conn.getTransaction(asset.id)
      const code = asset.data.asset.split(':')
      switch(code[code.length-1]) {
          case 'ownership':
              ownershipClaims = <BigChainOwnershipClaim> {
                assetData: transaction.asset.data.asset,
                contractAddress: transaction.metadata.contractAddress,
                identityURL:transaction.metadata.identityURL,
                bigChainPublicKey: transaction.metadata.signedKeys.bdb,
                ethereumPublicKey: transaction.metadata.signedKeys.ethereum.key,
                jolocomPublicKey: transaction.metadata.signedKeys.jolocom.key,
                bigChainTransactionOwner: transaction.inputs[0].owners_before[0],
                ethereumSignature: transaction.metadata.signedKeys.ethereum.signature,
                jolocomSignature: transaction.metadata.signedKeys.jolocom.signature
              }
              break;
          case 'functionality':
              functionalityClaims.push(<BigChainFunctionalityClaim>{
                assetData: transaction.asset.data.asset,
                creator: {identity : transaction.metadata.creator.identity, signature: transaction.metadata.creator.signature},
                ownershipClaimPointer: transaction.metadata.ownershipClaimPointer,
                functionalityObjectPointer : transaction.metadata.functionalityObjectPointer,
                contractHash: transaction.metadata.contractHash
              })
              break;
          case 'security':
              securityClaims.push(<BigChainSecurityClaim>{
                assetData: transaction.asset.data.asset,
                creator: {identity : transaction.metadata.creator.identity, signature: transaction.metadata.creator.signature},
                ownershipClaimPointer: transaction.metadata.ownershipClaimPointer,
                contractHash: transaction.metadata.contractHash,
                level: transaction.metadata.level
              })
              break;
          case 'functionalityObject':
              functionalityObjects.push(<BigChainFunctionalityObject>{
                assetData: transaction.asset.data.asset,
                creator: {identity : '--', signature: '--'},
                ownershipClaimPointer: transaction.metadata.ownershipClaim,
                contractInfo: transaction.metadata.functionalityObject
              })
              break;
      }
    }
    if (ownershipClaims === undefined){
      return null
    }
    return <BigChainContractInfo> {
      ownershipClaims: ownershipClaims,
      functionalityObjects: functionalityObjects,
      functionalityClaims: functionalityClaims,
      securityClaims: securityClaims
    }
  }

  async _buildContractCheckResult({
    publicKeys,
    contractInfo,
    contractHash
  } : {
    publicKeys,
    contractInfo : BigChainContractInfo,
    contractHash : string
  }) : Promise<ContractCheckResult> {
    let lowestSecurityClaim = <SecurityClaim> null
    let highestSecurityClaim = <SecurityClaim> null
    for (let claim of contractInfo.securityClaims) {
      if (lowestSecurityClaim === null || claim.level < lowestSecurityClaim.level) {
        lowestSecurityClaim = {
          identity: claim.creator.identity,
          level: claim.level,
          trustedVerifier: true
        }
      }
      if (highestSecurityClaim === null || claim.level > highestSecurityClaim.level) {
        highestSecurityClaim = {
          identity: claim.creator.identity,
          level: claim.level,
          trustedVerifier: true
        }
      }
    }

    let functionality = <Functionality> null
    let functionalityTimestamp = 0
    let functionalityHistory = []

    for (let func of contractInfo.functionalityObjects) {
      let temp = {
        name: func.contractInfo.name,
        description: func.contractInfo.description,
        methods: func.contractInfo.methods,
        timestamp: func.contractInfo.timestamp,
        verifications: [{
          identity: 'TODO - identity', trustedVerifier: true
        }]
      }
      if (func.contractInfo.timestamp >= functionalityTimestamp) {
        functionality = temp
      }
      functionalityHistory.push({
        timestamp: func.contractInfo.timestamp,
        current: false,
        functionality: temp
      })
    }
    if(functionalityHistory.length>0){
      functionalityHistory[functionalityHistory.length-1].current = true;
    }

    return <ContractCheckResult>{
      identityURL: contractInfo.ownershipClaims.identityURL,
      contractAddress: contractInfo.ownershipClaims.contractAddress,
      currentSecurity: {},
      lowestSecurityLevel: lowestSecurityClaim,
      highestSecurityLevel: highestSecurityClaim,
      functionality: functionality,
      functionalityHistory: functionalityHistory
    }
  }

  queryBigchainDB({
    contractID,
    contractHash
  } : {contractID: string,
    contractHash : string
  }){
    this._getConnection()
    let queryString = contractID
    if(contractHash)
      queryString += contractHash

    return this.conn.searchAssets(queryString)
        .then( tx => {return this.conn.getTransaction(tx[0].id)})//Retrieve the hole transaction
        .then(tx => {return tx})
  }

  private conn
  _getConnection() {
    if (!this.conn) {
      this.conn = new driver.Connection(API_PATH)
    }
  }

  // TODO move to publicKeyRetrievers
  private _getBdbPublicKey({seedPhrase}) {
    const keypair = new driver.Ed25519Keypair(bip39.mnemonicToSeed(seedPhrase).slice(0,32))
    return keypair.publicKey
  }

  // TODO move to publicKeyRetrievers
  private async _getEthereumPubKey({seedPhrase}) {
    const wallet = await this._walletManager.login({seedPhrase, pin: '1111'})
    const keys = wallet.getEncryptionKeys()
    return keys.publicKey
  }

  // TODO move to dataSigner?
  private async _createEthereumSignature({seedPhrase, message}) {
    const wallet = await this._walletManager.login({seedPhrase, pin: '1111'})
    const signature = wallet.signData({message})
    return signature
  }
}
