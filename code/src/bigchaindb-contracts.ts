import { DataSigner } from './data-signer'

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
    // Retrieve Jolocom + Ethereum public key of identityURL
    // Retrieve contract address from identity gateway

    // Retrieve contract and calculate hash
    // If retrieveHistory === false, query also for contract state hash

    // Retrieve everything about contract from BDB
    // Return null if no information stored on BDB
    // Check ownership claim validity, throw Error if not valid

    // Construct result object   
  }
}
