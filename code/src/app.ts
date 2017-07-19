const express = require('express')
const bodyParser = require('body-parser')

export function createApp({} :
                          {})
{
  const app = express()
  app.use(bodyParser.urlencoded({extended: true}))
  app.use(bodyParser.json())
  app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next()
  })

  // app.post(`/${verifier.attrType}/start-verification`, async (req, res) => {
  // })

  return app
}
