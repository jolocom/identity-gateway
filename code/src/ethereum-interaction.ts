export class EthereumInteraction {
  private _walletManager

  constructor({walletManager})
  {
    this._walletManager = walletManager
  }

  async getEtherBalance({mainAddress} : {mainAddress : string})
  {
    return await this._walletManager.getBalance({mainAddress})
  }

  async sendEther({seedPhrase, receiver, amountEther, data, gasInWei}) :
    Promise<{txHash}>
  {
    const wallet = this._walletManager.login({seedPhrase, pin: '1111'})
    const txHash = await wallet.sendEther({
      receiver, amountEther, data, gasInWei, pin: '1111'
    })
    return {txHash}
  }
}
