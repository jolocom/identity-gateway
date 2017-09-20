Identity Gateway 
=============

Identity gateway - backend logic for [smartwallet-app](https://github.com/jolocom/smartwallet-app/blob/develop/README.md)

Setup for development
---------------------
Setup requires Node.JS to be installed on your computer. If you do not have it please see:
https://nodejs.org/en/download/ 

## Installation

After cloning the identity-gateway repository to a directory on your computer. Enter the directory and run the following command:

```bash
npm install
```


## Building

In order to run the identity-gateway locally you need to open three terminal windows and run (one operation per window):

```bash
npm run prepare:watch
npm run testrpc
npm run devmon
```

## Additional Notes

Sessions will be stored by default in Redis. If you don't have it installed on your machine, please pass in environment variable SESSION_BACKEND=memory to npm run devmon:

```bash
SESSION_BACKEND=memory npm run devmon
```

You also have the following possibilities:
  - add, verify, and check email attribute
  - create an Ethereum Identity for the verification of attributes
  - Prevent the lookup contract to be re-created on every restart by providing an address, which you can find on the terminal if you don't     provide this option

The above mentioned possibilities are also triggered by the envrironmental variable: 

```bash
TEST_ATTRIBUTE_VERIFICATION=true npm run devmon
TEST_ETHEREUM_IDENTITY=true npm run devmon
LOOKUP_CONTRACT_ADDRESS=<address here> npm run devmon
```

The default seed phrase to log in to smartwallet-app is 'user1 seed phrase'.

You can also start it with another user. Pass in the envrironmental variable accordingly:

```bash
CREATE_SECOND_USER=true npm run devmon
```
In this case the seedphrase will be 'user2 seed phrase'.

Now you can build the smartwallet-app and pass in the following envrironmental variable:

```bash
USE_LOCAL_GATEWAY=true gulp wallet
```
See more information on how to build the smartwallet-app [here](https://github.com/jolocom/smartwallet-app/blob/develop/README.md).
