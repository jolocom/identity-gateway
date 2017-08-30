export class EthereumInteraction {
  private _walletManager

  constructor({walletManager})
  {
    this._walletManager = walletManager
  }

  async getEtherBalance({walletAddress} : {walletAddress : string})
  {
    return await this._walletManager.getBalance({mainAddress: walletAddress})
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
}
