import * as _ from 'lodash'
import * as events from 'events'

export default class EtherBalanceWatcher {
  public events
  private _walletManager
  private _balances = {}
  private _checking = false
  private _checkTaskID

  constructor({walletManager}) {
    this.events = new events.EventEmitter()
    this._walletManager = walletManager
  }

  startWatching({walletAddress}) {
    this._balances[walletAddress] = ''

    if (!this._checkTaskID) {
      this._checkTaskID = setInterval(() => {
        this.check()
      }, 2000)
    }
  }

  stopWatching({walletAddress}) {
    delete this._balances[walletAddress]

    if (Object.keys(this._balances).length === 0) {
      clearInterval(this._checkTaskID)
      this._checkTaskID = null
    }
  }

  async check() {
    if (this._checking) {
      return
    }

    this._checking = true
    await Promise.all(Object.keys(this._balances).map(async address => {
      const oldBalance = this._balances[address]
      const newBalance = await this._walletManager.getBalance({mainAddress: address})
      // const newBalance = oldBalance ? (parseFloat(oldBalance) + 0.001).toString() : '0.001'
      if (oldBalance !== newBalance) {
        this._balances[address] = newBalance
        this.events.emit('ether.balance.changed', {
          walletAddress: address, oldBalance, newBalance
        })
      }
    }))
    this._checking = false
  }
}

export class EtherBalanceDispatcher {
  public events
  private _userToWallets = {}
  private _walletToUsers = {}
  private _etherBalanceWatcher : EtherBalanceWatcher

  constructor({etherBalanceWatcher}) {
    this.events = new events.EventEmitter()

    this._etherBalanceWatcher = etherBalanceWatcher
    this._etherBalanceWatcher.events.on('ether.balance.changed', ({
      walletAddress, ...params
    }) => {
      _.each(this._walletToUsers[walletAddress] || {}, (_, userID) => {
        this.events.emit('ether.balance.dispatch', {
          userID, walletAddress, ...params
        })
      })
    })
  }

  setup({io, clients}) {
    this.events.on('ether.balance.dispatch', ({
      userID, ...params
    }) => {
      // console.log('emitting change for user', userID, clients[userID])
      if (clients[userID]) {
        clients[userID].emit('ether.balance.changed', params)
      }
    })
    io.on('connection', (client) => {
      this.setupClient({client})
    })
  }

  setupClient({client}) {
    const userID = client.request.user.id

    client.on('disconnect', () => {
      this.stopWatching({userID})
    })

    client.on('ether.balance.watch', ({walletAddress}) => {
      this.startWatching({userID, walletAddress})
    })

    client.on('ether.balance.unwatch', ({walletAddress}) => {
      if (!walletAddress || !/^0x[A-Za-z0-9]+$/.test(walletAddress)) {
        console.error('got invalid stop watching address', walletAddress)
      }
      this.stopWatching({userID, walletAddress})
    })
  }

  startWatching({userID, walletAddress}) {
    // console.log('start watching', walletAddress, 'for user', userID)

    this._userToWallets[userID] = this._userToWallets[userID] || {}
    this._userToWallets[userID][walletAddress] = true

    this._walletToUsers[walletAddress] = this._walletToUsers[walletAddress] || {}
    this._walletToUsers[walletAddress][userID] = true

    this._etherBalanceWatcher.startWatching({walletAddress})
  }

  stopWatching({userID, walletAddress} : {userID : string, walletAddress? : string}) {
    // console.log('stop watching', walletAddress, 'for user', userID)

    if (walletAddress) {
      this._userToWallets[userID] && delete this._userToWallets[userID][walletAddress]
      this._walletToUsers[walletAddress] && delete this._walletToUsers[walletAddress][userID]

      if (Object.keys(this._walletToUsers).length === 0) {
        this._etherBalanceWatcher.stopWatching({walletAddress})
      }
    } else {
      this.stopWatchingWallets({userID})
    }
  }

  stopWatchingWallets({userID}) {
    _.each(this._userToWallets[userID] || {}, (irrelevant, walletAddresses) => {
      _.each(walletAddresses, (_, walletAddress) => {
        // console.log(walletAddress)
        // this.stopWatching({walletAddress, userID})
      })
    })
  }
}
