import * as Bdb from './bigchaindb-contracts'
import { DataSigner } from './data-signer'

const bdbint = new Bdb.BigChainInteractions({})
bdbint.createBDBTransaction({seedPhrase:'super batman secure seed string',assetdata:'data',metadata:'metadata'})
