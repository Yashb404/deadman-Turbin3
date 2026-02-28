// Import this from your anchor program's generated IDL
// For now, this is a type stub
export const IDL = {
  "version": "0.1.0",
  "name": "deadman",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        { "name": "owner", "isMut": true, "isSigner": true },
        { "name": "beneficiary", "isMut": false, "isSigner": false },
        { "name": "mint", "isMut": false, "isSigner": false },
        { "name": "ownerTokenAccount", "isMut": true, "isSigner": false },
        { "name": "vaultTokenAccount", "isMut": true, "isSigner": false },
        { "name": "vaultState", "isMut": true, "isSigner": false },
        { "name": "tokenProgram", "isMut": false, "isSigner": false },
        { "name": "systemProgram", "isMut": false, "isSigner": false },
        { "name": "rent", "isMut": false, "isSigner": false }
      ],
      "args": [
        { "name": "interval", "type": "i64" },
        { "name": "gracePeriod", "type": "i64" },
        { "name": "depositAmount", "type": "u64" }
      ]
    },
    {
      "name": "ping",
      "accounts": [
        { "name": "owner", "isMut": true, "isSigner": true },
        { "name": "vaultState", "isMut": true, "isSigner": false }
      ],
      "args": []
    },
    {
      "name": "updateInterval",
      "accounts": [
        { "name": "owner", "isMut": true, "isSigner": true },
        { "name": "vaultState", "isMut": true, "isSigner": false }
      ],
      "args": [
        { "name": "newInterval", "type": "i64" }
      ]
    },
    {
      "name": "updateBeneficiary",
      "accounts": [
        { "name": "owner", "isMut": true, "isSigner": true },
        { "name": "vaultState", "isMut": true, "isSigner": false }
      ],
      "args": [
        { "name": "newBeneficiary", "type": "publicKey" }
      ]
    },
    {
      "name": "deposit",
      "accounts": [
        { "name": "owner", "isMut": true, "isSigner": true },
        { "name": "vaultState", "isMut": false, "isSigner": false },
        { "name": "ownerTokenAccount", "isMut": true, "isSigner": false },
        { "name": "vaultTokenAccount", "isMut": true, "isSigner": false },
        { "name": "tokenProgram", "isMut": false, "isSigner": false }
      ],
      "args": [
        { "name": "amount", "type": "u64" }
      ]
    },
    {
      "name": "ownerWithdraw",
      "accounts": [
        { "name": "owner", "isMut": true, "isSigner": true },
        { "name": "vaultState", "isMut": false, "isSigner": false },
        { "name": "vaultTokenAccount", "isMut": true, "isSigner": false },
        { "name": "ownerTokenAccount", "isMut": true, "isSigner": false },
        { "name": "tokenProgram", "isMut": false, "isSigner": false }
      ],
      "args": [
        { "name": "amount", "type": "u64" }
      ]
    },
    {
      "name": "withdraw",
      "accounts": [
        { "name": "beneficiary", "isMut": true, "isSigner": true },
        { "name": "vaultState", "isMut": true, "isSigner": false },
        { "name": "vaultTokenAccount", "isMut": true, "isSigner": false },
        { "name": "beneficiaryTokenAccount", "isMut": true, "isSigner": false },
        { "name": "tokenProgram", "isMut": false, "isSigner": false }
      ],
      "args": []
    },
    {
      "name": "cancelVault",
      "accounts": [
        { "name": "owner", "isMut": true, "isSigner": true },
        { "name": "vaultState", "isMut": true, "isSigner": false },
        { "name": "vaultTokenAccount", "isMut": true, "isSigner": false },
        { "name": "ownerTokenAccount", "isMut": true, "isSigner": false },
        { "name": "tokenProgram", "isMut": false, "isSigner": false }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "VaultState",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "owner", "type": "publicKey" },
          { "name": "beneficiary", "type": "publicKey" },
          { "name": "mint", "type": "publicKey" },
          { "name": "interval", "type": "i64" },
          { "name": "gracePeriod", "type": "i64" },
          { "name": "lastPingTime", "type": "i64" },
          { "name": "bump", "type": "u8" }
        ]
      }
    }
  ]
} as const;
