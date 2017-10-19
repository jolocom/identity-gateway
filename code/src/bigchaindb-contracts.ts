import { DataSigner } from './data-signer'

export interface SecurityClaim {
  
}

export interface FunctionalityObject {

}

export interface Functionality extends FunctionalityObject {

}

export interface ContractCheckResult {

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
}
