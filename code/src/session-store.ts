export interface SessionStore {
  serializeUser(user : object) : Promise<string>
  deserializeUser(sessionId : string) : Promise<any>
}

export class MemorySessionStore {
  private _sessions = []

  async serializeUser(user) {
    this._sessions.push(user)
    return (this._sessions.length).toString()
  }

  async deserializeUser(sessionId) {
    return this._sessions[parseInt(sessionId) - 1]
  }
}
