import { DataSigner } from './data-signer'
import * as driver from 'bigchaindb-driver'

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
  identityURL : string
  bigChainPublicKeySignature : string
  ethereumPublicKeySignature : string
  jolocomPublicKeySignature : string
}

interface BigChainFunctionalityObject {

}

interface BigChainFunctionalityClaim {

}

interface BigChainSecurityClaim {

}

interface BigChainContractInfo {
  ownershipClaim : BigChainOwnershipClaim
  functionalityObject : BigChainFunctionalityObject
  functionalityClaims : BigChainFunctionalityClaim
  securityClaims : BigChainSecurityClaim
}

export class BigChainInteractions {
  constructor({walletManager, dataSigner} : {walletManager, dataSigner : DataSigner}) {

  }

  createOwnershipClaim(
    {seedPhrase, identityURL, contractName} :
    {seedPhrase : string, identityURL : string, contractName : string}
  ) {

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
      contractHash: retrieveHistory ? contractHash : null
    })

    if (!contractInfo) {
      return null
    }

    const isOwnershipValid = await this._checkOwnershipValidity({publicKeys})
    if (!isOwnershipValid) {
      throw new ContractOwnershipError("Could not verify contract ownership")
    }
    
    return await this._buildContractCheckResult({
      publicKeys, contractInfo, contractHash
    })
  }

  async _buildContractCheckResult(
    {publicKeys, contractInfo, contractHash} :
    {publicKeys, contractInfo, contractHash : string}
  ) : Promise<ContractCheckResult> {


    return {
      currentSecurity,
      lowestSecurityLevel,
      highestSecurityLevel,
      functionality,
      functionalityHistory
    }
  }

  private conn
  async _getConnection() {
    if (!this.conn) {
      this.conn = new driver.Connection('http://ec2-35-157-164-199.eu-central-1.compute.amazonaws.com:49994')
    }
  }
}
