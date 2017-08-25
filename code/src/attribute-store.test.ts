import * as moment from 'moment'
import { expect } from 'chai'
import { AttributeStore, MemoryAttributeStore } from './attribute-store'

function testAttributeStore({attributeStore} : {attributeStore : AttributeStore}) {
  it('should be able to store and delete string attibutes', async () => {
    let email = await attributeStore.retrieveAttribute({userId: 'john', type: 'email', id: 'primary'})
    expect(email).to.equal(undefined)

    await attributeStore.storeStringAttribute({userId: 'john', type: 'email', id: 'primary', value: 'test@test.com'})
    email = await attributeStore.retrieveAttribute({userId: 'john', type: 'email', id: 'primary'})
    expect(email).to.equal({value: 'test@test.com', dataType: 'string'})
    
    await attributeStore.deleteAttribute({userId: 'john', type: 'email', id: 'primary'})
    email = await attributeStore.retrieveAttribute({userId: 'john', type: 'email', id: 'primary'})
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
