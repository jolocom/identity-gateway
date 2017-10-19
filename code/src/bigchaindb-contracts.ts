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

export class BigChainInteractions {
  constructor({walletManager}) {

  }

  createOwnershipClaim(
    {seedPhrase, identityURL, contractName} :
    {seedPhrase : string, identityURL : string, contractName : string}
  ) {

  }

  createFunctionalityObject({
    seedPhrase, identityURL, contractName,
    sourceIdentityURL, dataSigner,
    object
  } : {
    seedPhrase : string, identityURL : string, contractName : string,
    sourceIdentityURL : string, dataSigner : DataSigner,
    object : FunctionalityObject
  }) {

  }

  createFunctionalityClaim({
    seedPhrase, identityURL, sourceIdentityURL,
    dataSigner, contractName
  } : {
    seedPhrase : string, identityURL : string, sourceIdentityURL : string,
    dataSigner : DataSigner, contractName : string
  }) {

  }

  createSecurityClaim({
    seedPhrase, identityURL, contractName,
    sourceIdentityURL, dataSigner,
    level
  } : {
    seedPhrase : string, identityURL : string, contractName : string,
    sourceIdentityURL : string, dataSigner : DataSigner,
    level : number
  }) {

  }

  checkContract(
    {identityURL, contractName, retrieveHistory} :
    {identityURL : string, contractName : string, retrieveHistory? : boolean}
  ) : ContractCheckResult | null {

  }

  private conn
  async _getConnection() {
    if (!this.conn) {
      this.conn = new driver.Connection('http://ec2-35-157-164-199.eu-central-1.compute.amazonaws.com:49994')
    }
  }
}
