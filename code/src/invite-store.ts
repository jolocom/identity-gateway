import { CodeGenerator } from './code-generator';

export abstract class InviteStore implements InviteStore {
  private _codeGenerator : CodeGenerator

  constructor({codeGenerator} : {codeGenerator : CodeGenerator}) {
    this._codeGenerator = codeGenerator
  }
  
  async generate({code} : {code? : string}) : Promise<string> {
    if (!code) {
      code = this._codeGenerator.generateCode()
    }
    await this.store(code)
    return code
  }

  async check({code, dontDelete} : {code : string, dontDelete? : boolean})
    : Promise<boolean>
  {
    const exists = await this.exists(code)
    if (!dontDelete) {
      await this.remove(code)
    }
    return exists
  }

  abstract store(code) : Promise<any>
  abstract exists(code) : Promise<boolean>
  abstract remove(code) : Promise<any>
}

export class SequelizeInviteStore extends InviteStore {
  private _inviteModel

  constructor({inviteModel, codeGenerator} : {inviteModel, codeGenerator : CodeGenerator}) {
    super({codeGenerator})

    this._inviteModel = inviteModel
  }

  async store(code) : Promise<any> {
    // console.log('storing', code)
    await this._inviteModel.findOrCreate({where: {code}})
  }

  async exists(code) : Promise<boolean> {
    const invite = await this._inviteModel.findOne({where: {code}})
    // console.log('exists', code, !!invite)
    return !!invite
  }

  async remove(code) : Promise<any> {
    await this._inviteModel.destroy({where: {code}})
  }
}
