export class EthereumInteraction {
  private _walletManager

  constructor({walletManager})
  {
    this._walletManager = walletManager
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
}
