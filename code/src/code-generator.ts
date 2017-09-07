import * as randtoken from 'rand-token'

export interface CodeGenerator {
  generateCode() : string
}

export class SingleCodeGenerator implements CodeGenerator {
  constructor(public code : string) {
  }

  generateCode() : string {
    return this.code
  }
}

export class RandomCodeGenerator implements CodeGenerator {
  private codeLength : number
  private digitOnly : boolean

  constructor({codeLength, digitOnly} : {codeLength : number, digitOnly : boolean}) {
    this.codeLength = codeLength
    this.digitOnly = digitOnly
  }

  generateCode() : string {
    const elements = this.digitOnly ? '0123456789'
      : '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    return randtoken.generate(this.codeLength, elements)
  }
}
