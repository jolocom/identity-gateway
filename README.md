# identity-gateway
Gateway - how to use it locally

Step 1 - run identity-gateway locally

Three terminals (using node v6):
npm run prepare:watch
npm run testrpc
npm run devmon

Devmon takes various environment vars:
SESSION_BACKEND: redis by default, can be set to memory
TEST_ATTRIBUTE_VERIFICATION: true, false by default, adds, verifies and checks an e-mail attribute
TEST_ETHEREUM_IDENTITY: Creates an Ethereum identity for the verification of attributes
LOOKUP_CONTRACT_ADDRESS: Prevent the lookup contract to be re-created on every restart by providing an address, which you can find on the terminal if you don't provide this option.

The default seed phrase is 'user1 seed phrase' 
If you start with the env variable:  CREATE_SECOND_USER=true, 'user2 seed phrase' is the seed phrase to use

Step 2 - run smartwallet-app

start with USE_LOCAL_GATEWAY  (USE_LOCAL_GATEWAY=true gulp wallet)
login with 'user1 seed phrase' (or user2 seed phrase if you started gateway with CREATE_SECOND_USER=true)
