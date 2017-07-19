require('source-map-support').install()
require('regenerator-runtime/runtime')
import * as http from 'http'
import * as bluebird from 'bluebird'
import { createApp } from './app'

const DEVELOPMENT_MODE = process.env.NODE_ENV === 'dev';


export async function main() : Promise<any> {   
  try {
    const app = createApp({
      
    })
  
    const server = http.createServer(app)
    return await new Promise((resolve, reject) => {
      server.listen(4567, (err) => {
        if (err) { return reject(err) }
        resolve(server)
      })
    })

  } catch (e) {
    console.error(e)
    console.trace()
  }
}


if(require.main === module){
  main();
}
