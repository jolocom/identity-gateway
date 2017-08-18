export class EthereumInteraction {
  private _walletManager

  constructor({wallet} :
              {wallet})
  {
    this._wallet = wallet
  }

  async getEtherBalance({mainAddress}) :
  Promise<{balanceEther}>
  {
    let wallet = await this._wallet.getBalance({
      mainAddress
    })
    return {
      balanceEther: '33.71'
    }
  }

  // async sendEther({})

}
