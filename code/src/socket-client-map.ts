import * as _ from 'lodash'

export class SocketClientMap {
  public clients = {}

  setup({io}) {
    io.on('connection', (client) => {
      console.log('Client connected...', client.request.user)

      const userID = client.request.user.id

      if (!this.clients[userID]) {
        this.clients[userID] = {
          connections: {},
          emit: (...params) => {
            _.each(this.clients[userID].connections, client => {
              client.emit(...params)
            })
          }
        }
      }
      this.clients[userID] = this.clients[client.request.user.id]
      this.clients[userID].connections[client.id] = client

      client.on('disconnect', () => {
        if (this.clients[userID]) {
          delete this.clients[userID].connections[client.id]
        }
      })
    })
  }
}