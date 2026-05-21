// const crypto = require("crypto");
// const fs = require("fs");

// const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");

// const privatePem = privateKey.export({
//   type: "pkcs8",
//   format: "pem",
// });

// const publicPem = publicKey.export({
//   type: "spki",
//   format: "pem",
// });

// fs.writeFileSync("private_key.pem", privatePem);
// fs.writeFileSync("public_key.pem", publicPem);

// const privateBase64 = Buffer.from(privatePem).toString("base64");
// const publicBase64 = Buffer.from(publicPem).toString("base64");

// console.log("\n========================");
// console.log("COPY THESE INTO .env");
// console.log("========================\n");

// console.log(`ED25519_PRIVATE_KEY_PEM_BASE64=${privateBase64}\n`);
// console.log(`ED25519_PUBLIC_KEY_PEM_BASE64=${publicBase64}\n`);