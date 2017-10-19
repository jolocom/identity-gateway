import * as _ from 'lodash'
import { DataSigner } from './data-signer'
import * as driver from 'bigchaindb-driver'
import bip39 from 'bip39'

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
  identityURLSignature : string // PGP signed cleartext identity URL
  bigChainPublicKeySignature : string
  ethereumPublicKeySignature : string
  jolocomPublicKeySignature : string
  contractAddress : string
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
type SignatureCheckers = {[type : string] : (
  {publicKey, signature, message} :
  {publicKey : string, signature : string, message? : string}
) => Promise<boolean>}

export class BigChainInteractions {
  private _walletManager
  private _dataSigner : DataSigner
  private _publicKeyRetrievers : PublicKeyRetrievers
  private _signatureCheckers : SignatureCheckers

  constructor(
    {walletManager, dataSigner, publicKeyRetrievers, signatureCheckers} :
    {walletManager, dataSigner : DataSigner,
     publicKeyRetrievers : PublicKeyRetrievers,
     signatureCheckers : SignatureCheckers}
  ) {
    this._walletManager = walletManager
    this._dataSigner = dataSigner
    this._publicKeyRetrievers = publicKeyRetrievers
    this._signatureCheckers = signatureCheckers
  }

  createBDBTransaction(
    {seedPhrase, assetdata, metadata}:{ seedPhrase: string, assetdata: any, metadata: any}
  ){

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
    {seedPhrase, identityURL, contractName} :
    {seedPhrase : string, identityURL : string, contractName : string}
  ) {
    const assetdata = identityURL + contractName + 'ownership'
    const metadata = {}
    this.createBDBTransaction({seedPhrase, assetdata, metadata})
  }

  createFunctionalityObject({
    seedPhrase, identityURL, contractName,
    object
  } : {
    seedPhrase : string, identityURL : string, contractName : string,
    object : FunctionalityObject
  }) {

  }

  createFunctionalityClaim({
    seedPhrase, identityURL, sourceIdentityURL,
    contractName
  } : {
    seedPhrase : string, identityURL : string, sourceIdentityURL : string,
    contractName : string
  }) {
    const assetdata = identityURL + contractName + 'functionality'
    const metadata = {}
    this.createBDBTransaction({seedPhrase, assetdata, metadata})
  }

  createSecurityClaim({
    seedPhrase, identityURL, contractName,
    sourceIdentityURL,
    level
  } : {
    seedPhrase : string, identityURL : string, contractName : string,
    sourceIdentityURL : string,
    level : number
  }) {
    const assetdata = identityURL + contractName + 'security'
    const metadata = {}
    this.createBDBTransaction({seedPhrase, assetdata, metadata})
  }

  async checkContract(
    {identityURL, contractName, retrieveHistory} :
    {identityURL : string, contractName : string, retrieveHistory? : boolean}
  ) : Promise<ContractCheckResult | null> {
    const publicKeys = await this._retrievePublicKeys({identityURL})
    const contractAddress = await this._retrieveContractAddress({identityURL, contractName})
    const contractHash = await this._retrieveContractHash({contractAddress})
    const contractInfo = await this._retrieveContractInfo({
      identityURL, contractName, contractAddress,
      contractHash: !retrieveHistory ? contractHash : null
    })



    if (!contractInfo) {
      return null
    }

    const isOwnershipValid = await this._checkOwnershipValidity({contractInfo, publicKeys})
    if (!isOwnershipValid) {
      throw new ContractOwnershipError("Could not verify contract ownership")
    }

    return await this._buildContractCheckResult({
      publicKeys, contractInfo, contractHash
    })
  }

  async _retrievePublicKeys({identityURL}) {
    return {
      jolocom: await this._publicKeyRetrievers.jolocom(identityURL),
      ethereum: await this._publicKeyRetrievers.ethereum(identityURL),
      bigChain: await this._publicKeyRetrievers.bigChain(identityURL),
    }
  }

  async _checkOwnershipValidity(
    {contractInfo, publicKeys} : 
    {contractInfo : BigChainContractInfo, publicKeys}
  ) {
    const toCheck = [
      {type: 'jolocom', signature: contractInfo.ownershipClaim.identityURLSignature},
      {type: 'jolocom', signature: contractInfo.ownershipClaim.jolocomPublicKeySignature},
      {type: 'ethereum', signature: contractInfo.ownershipClaim.ethereumPublicKeySignature},
      {type: 'bigChain', signature: contractInfo.ownershipClaim.bigChainPublicKeySignature},
    ]
    const checked = Promise.all(toCheck.map(check => {
      return this._signatureCheckers[check.type]({
        publicKey: publicKeys[check.type],
        signature: check.signature,
        // message: check.message
      })
    }))
    return _.every(checked)
  }
  
  async _retrieveContractAddress(){

  }
  async _retrieveContractHash(){

  }
  async _retrieveContractInfo(){

  }
  async _checkOwnershipValidity(){

  }

  async _buildContractCheckResult(
    {publicKeys, contractInfo, contractHash} :
    {publicKeys, contractInfo : BigChainContractInfo, contractHash : string}
  ) : Promise<ContractCheckResult> {

    const queryString = contractInfo
    if(contractHash):
      queryString += contractHash

    this.conn.searchAssets(queryString)
        .then(assets => console.log('asset: ', assets))


    return {
      currentSecurity,
      lowestSecurityLevel,
      highestSecurityLevel,
      functionality,
      functionalityHistory
    }
  }

  queryBigchainDB(
    {contractName, contractHash} :
    {publicKeys, contractName, contractHash : string}
  ){
    const queryString = contractName
    if(contractHash):
      queryString += contractHash

    this.conn.searchAssets(queryString)
        .then(assets => console.log('asset: ', assets))

  }

  private conn
  async _getConnection() {
    if (!this.conn) {
      this.conn = new driver.Connection('http://ec2-35-157-164-199.eu-central-1.compute.amazonaws.com:49994')
    }
  }
}
