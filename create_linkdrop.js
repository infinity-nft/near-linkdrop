// Create a real linkdrop for testing
const { KeyPair } = require('near-api-js');

// Generate new keypair for linkdrop
const keyPair = KeyPair.fromRandom('ed25519');

console.log('=== LINKDROP KEYPAIR ===');
console.log('Public Key:', keyPair.getPublicKey().toString());
console.log('Private Key:', keyPair.toString());
console.log('');
console.log('=== CLAIM URL ===');
console.log('http://localhost:8080/?key=' + keyPair.toString());
console.log('');
console.log('=== COMMAND TO CREATE LINKDROP ===');
console.log(`cargo near call abhorrent-metal.testnet send '{"public_key": "${keyPair.getPublicKey().toString()}"}' --deposit 0.5 network-config testnet sign-with-keychain`);
