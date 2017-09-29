import { WalletManager } from 'smartwallet-contracts/lib/manager';
export type ContractInfoRetriever = ({
  contractOwnerIdentity, contractID
}) => Promise<{abi, address}>

export class EthereumInteraction {
  private _walletManager
  private _contractInfoRetriever : ContractInfoRetriever

  constructor({walletManager, contractInfoRetriever} :
              {walletManager : WalletManager, contractInfoRetriever : ContractInfoRetriever})
  {
    this._walletManager = walletManager
    this._contractInfoRetriever = contractInfoRetriever
  }

  async getEtherBalance({walletAddress} : {walletAddress : string})
  {
    if (walletAddress !== '0xdeadbeef') {
      return await this._walletManager.getBalance({mainAddress: walletAddress})
    } else {
      return '0o0'
    }
  }

  async sendEther({seedPhrase, receiver, amountEther, data, gasInWei}) :
    Promise<{txHash}>
  {
    const wallet = await this._walletManager.login({seedPhrase, pin: '1111'})
    const txHash = await wallet.sendEther({
      receiver, amountEther, data, gasInWei, pin: '1111'
    })
    return {txHash}
  }

  async executeCall({contractOwnerIdentity, contractID, method, params}) {
    const {abi, address} = await this._contractInfoRetriever({
      contractOwnerIdentity, contractID
    })
    const res = await this._walletManager.executeCall({abi, address, method, params})
    return res
  }

  async executeTransaction({contractOwnerIdentity, contractID, method, params, value, seedPhrase}) {
    const {abi, address} = await this._contractInfoRetriever({
      contractOwnerIdentity, contractID
    })
    const wallet = await this._walletManager.login({seedPhrase, pin: '1111'})
    return {
      txHash: await wallet.executeTransaction({abi, address, method, value, params, pin: '1111'})
    }
  }

  async deployContract({seedPhrase, abi, unlinkedBinary, constructorArgs}) {
    const wallet = await this._walletManager.login({seedPhrase, pin: '1111'})
    const address = await wallet.lightWallet.createContract({
      contractInfo: {abi, unlinked_binary: unlinkedBinary},
      args: constructorArgs || [],
      pin: '1111',
    })
    return {address}
  }
}
