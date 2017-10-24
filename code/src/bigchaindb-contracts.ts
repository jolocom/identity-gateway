import * as _ from 'lodash'
import { DataSigner } from './data-signer'
import * as driver from 'bigchaindb-driver'
import * as bip39 from 'bip39'

export interface SecurityClaim {
  identity : string
	level : number
	trustedVerifier : boolean
}

export interface MethodMap {
  [methodName : string] : {description : string}
}

export interface FunctionalityObject {
  description : string
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

  bigChainSignature : string
  ethereumSignature : string
  jolocomSignature : string
}

interface BigChainFunctionalityObject {
  assetData : string
  identityURLSignature : string // PGP signed cleartext identity URL
  ownershipClaimPointer : string
  object : FunctionalityObject
}

interface BigChainFunctionalityClaim {
  assetData : string
  identityURLSignature : string // PGP signed cleartext identity URL
  ownershipClaimPointer : string
  functionalityObjectPointer : string
  contractHash : string
}

interface BigChainSecurityClaim {
  assetData : string
  identityURLSignature : string // PGP signed cleartext identity URL
  ownershipClaimPointer : string
  contractHash : string
  level : number
}

interface BigChainContractInfo {
  ownershipClaim : BigChainOwnershipClaim
  functionalityObjects : BigChainFunctionalityObject[]
  functionalityClaims : BigChainFunctionalityClaim[]
  securityClaims : BigChainSecurityClaim[]
}

type PublicKeyRetrievers = {[type : string] : (identityURL) => Promise<string>}
type ContractAddressRetriever = ({identityURL, contractID}) => Promise<string>

type SignatureCheckers = {[type : string] : (
  {publicKey, signature, message} :
  {publicKey : string, signature? : string, message : string}
) => Promise<boolean>}

export class BigChainInteractions {
  private _walletManager
  private _dataSigner : DataSigner
  // private _publicKeyRetrievers : PublicKeyRetrievers
  private _contractAddressRetriever : ContractAddressRetriever
  private _signatureCheckers : SignatureCheckers

  constructor(
    {walletManager, dataSigner, contractAddressRetriever, signatureCheckers} :
    {walletManager, dataSigner : DataSigner,
    //  publicKeyRetrievers : PublicKeyRetrievers,
     contractAddressRetriever : ContractAddressRetriever,
     signatureCheckers : SignatureCheckers}
  ) {
    this._walletManager = walletManager
    this._dataSigner = dataSigner
    // this._publicKeyRetrievers = publicKeyRetrievers
    this._contractAddressRetriever = contractAddressRetriever
    this._signatureCheckers = signatureCheckers
  }

  createBDBTransaction(
    {seedPhrase, assetdata, metadata}:{ seedPhrase: string, assetdata: any, metadata: any}
  ){
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
  }

  createOwnershipClaim(
    {seedPhrase, identityURL, contractID} :
    {seedPhrase : string, identityURL : string, contractID : string}
  ) {
    const assetdata = {asset : identityURL +';'+ contractID +';'+ 'ownership'}
    const metadata = {signature: 'TODO signed publicKeys with privateKey'}
    return this.createBDBTransaction({seedPhrase, assetdata, metadata})
  }

  createFunctionalityObject({
    seedPhrase, identityURL, contractID,
    object
  } : {
    seedPhrase : string, identityURL : string, contractID : string,
    object : FunctionalityObject
  }) {

  }

  createFunctionalityClaim({
    seedPhrase, identityURL, sourceIdentityURL,
    contractID
  } : {
    seedPhrase : string, identityURL : string, sourceIdentityURL : string,
    contractID : string
  }) {
    const assetdata = {asset:identityURL +';'+ contractID +';'+ 'functionality'}
    const metadata = {functionality:'TODO pointer_to_contract'}
    return this.createBDBTransaction({seedPhrase, assetdata, metadata})
  }

  createSecurityClaim({
    seedPhrase, identityURL, contractID,
    sourceIdentityURL,
    level
  } : {
    seedPhrase : string, identityURL : string, contractID : string,
    sourceIdentityURL : string,
    level : number
  }) {
    const assetdata = {asset:identityURL +';'+ contractID +';'+ 'security'}
    const metadata = {sourceIdentityURL:sourceIdentityURL,level:level}
    return this.createBDBTransaction({seedPhrase, assetdata, metadata})
  }

  async checkContract(
    {identityURL, contractID, retrieveHistory} :
    {identityURL : string, contractID : string, retrieveHistory? : boolean}
  ) : Promise<ContractCheckResult | null> {
    const contractAddress = await this._contractAddressRetriever({identityURL, contractID})
    const contractHash = await this._retrieveContractHash({contractAddress})
    const contractInfo = await this._retrieveContractInfo({
      identityURL, contractID,
      contractHash: !retrieveHistory ? contractHash : null
    })

    if (!contractInfo) {
      return null
    }

    const publicKeys = await this._retrievePublicKeys({contractInfo})
    const isOwnershipValid = await this._checkOwnershipValidity({contractInfo, publicKeys})
    if (!isOwnershipValid) {
      throw new ContractOwnershipError("Could not verify contract ownership")
    }

    return await this._buildContractCheckResult({
      publicKeys, contractInfo, contractHash
    })
  }

  async _retrievePublicKeys({contractInfo} : {contractInfo : BigChainContractInfo}) {
    return {
      jolocom: contractInfo.ownershipClaim.jolocomPublicKey,
      ethereum: contractInfo.ownershipClaim.ethereumPublicKey,
      bigChain: contractInfo.ownershipClaim.bigChainPublicKey,
    }
  }

  async _checkOwnershipValidity(
    {contractInfo, publicKeys} :
    {contractInfo : BigChainContractInfo, publicKeys}
  ) {
    const toCheck = [
      {type: 'jolocom', signature: contractInfo.ownershipClaim.jolocomSignature},
      {type: 'ethereum', signature: contractInfo.ownershipClaim.ethereumSignature},
      {type: 'bigChain', signature: contractInfo.ownershipClaim.bigChainSignature},
    ]
    const checked = Promise.all(toCheck.map(check => {
      return this._signatureCheckers[check.type]({
        publicKey: publicKeys[check.type],
        signature: check.signature,
        message: [
          contractInfo.ownershipClaim.identityURL,
          contractInfo.ownershipClaim.contractAddress,
          publicKeys.jolocom,
          publicKeys.ethereum,
          publicKeys.bigChain,
        ].join(':')
      })
    }))
    return _.every(checked)
  }

  async _retrieveContractHash({contractAddress}){
    return ''
  }
  async _retrieveContractInfo({identityURL, contractID, contractHash}) : Promise<BigChainContractInfo> {
    // query for <identityURL>:<contractID>

    // TODO temp data
    return {
      ownershipClaim : {
        assetData: '',
        contractAddress : '',
        identityURL: '',
        bigChainPublicKey: '',
        ethereumPublicKey: '',
        jolocomPublicKey: '',
        bigChainSignature: '',
        ethereumSignature: '',
        jolocomSignature: '',
      },
      functionalityObjects : [],
      functionalityClaims : [],
      securityClaims : []
    }
  }

  async _buildContractCheckResult(
    {publicKeys, contractInfo, contractHash} :
    {publicKeys, contractInfo : BigChainContractInfo, contractHash : string}
  ) : Promise<ContractCheckResult> {

    let queryString = ''//contractInfo
    if(contractHash)
      queryString += contractHash

    this.conn.searchAssets(queryString)
        .then(assets => console.log('asset: ', assets))

    // temp comment for testing
    return {
      identityURL: '',
      contractAddress: '',
      currentSecurity :{},
      lowestSecurityLevel: {
        identity: '',
        level: 0,
        trustedVerifier: true
      },
      highestSecurityLevel: {
        identity: '',
        level: 0,
        trustedVerifier: true
      },
      functionality: {
        verifications: [{
          identity: '', trustedVerifier: true
        }],
        description: '',
        methods: {
          ['kra']: {
            description : 'r'
          }
        }
      },
      functionalityHistory: []
    }
  }

  queryBigchainDB(
    {contractID, contractHash} :
    {publicKeys, contractID, contractHash : string}
  ){
    let queryString = contractID
    if(contractHash)
      queryString += contractHash

    this.conn.searchAssets(queryString)
        .then(assets => console.log('asset: ', assets))

  }

  private conn
  async _getConnection() {
    if (!this.conn) {
      const API_PATH = 'http://ec2-35-157-164-199.eu-central-1.compute.amazonaws.com:49994/api/v1/'
      this.conn = new driver.Connection(API_PATH)

    }
  }
}
