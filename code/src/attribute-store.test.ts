import * as moment from 'moment'
import { expect } from 'chai'
import { AttributeStore, MemoryAttributeStore } from './attribute-store'

function testAttributeStore({attributeStore} : {attributeStore : AttributeStore}) {
  it('should be able to store and delete string attibutes', async () => {
    let email = await attributeStore.retrieveStringAttribute({userId: 'john', type: 'email', id: 'primary'})
    expect(email).to.equal(undefined)

    await attributeStore.storeStringAttribute({userId: 'john', type: 'email', id: 'primary', value: 'test@test.com'})
    email = await attributeStore.retrieveStringAttribute({userId: 'john', type: 'email', id: 'primary'})
    expect(email).to.equal('test@test.com')
    
    await attributeStore.deleteStringAttribute({userId: 'john', type: 'email', id: 'primary'})
    email = await attributeStore.retrieveStringAttribute({userId: 'john', type: 'email', id: 'primary'})
    expect(email).to.equal(undefined)
  })
}

describe('Memory attribute store', () => {
  const attributeStore = new MemoryAttributeStore()
  
  beforeEach(() => {
    attributeStore.clear()
  })

  testAttributeStore({attributeStore})
})
